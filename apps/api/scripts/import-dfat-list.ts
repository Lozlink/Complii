import { config } from '@dotenvx/dotenvx';
import * as path from 'path';

// Load env.local from project root
config({ path: path.join(__dirname, '../../../env.local') });

import { getServiceClient } from '../src/lib/db/client';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

const supabase = getServiceClient();



// Try the direct download link
const DFAT_URL = 'https://www.dfat.gov.au/sites/default/files/Australian_Sanctions_Consolidated_List.xlsx';

interface SanctionedEntity {
  name: string;
  aliases: string[];
  date_of_birth?: string;
  nationality?: string;
  entity_type: 'individual' | 'entity';
  listing_info: string;
  reference_number: string;
}

async function downloadDFATList(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const download = (url: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }

      const client = url.startsWith('https') ? https : http;

      console.log(`Downloading from: ${url}`);

      client.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            console.log(`Following redirect to: ${redirectUrl}`);
            download(redirectUrl, redirectCount + 1);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        console.log(`Content-Type: ${response.headers['content-type']}`);
        console.log(`Content-Length: ${response.headers['content-length']}`);

        const chunks: Buffer[] = [];

        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);

          // Save to file for debugging
          const tempPath = path.join(__dirname, 'dfat-download.xlsx');
          fs.writeFileSync(tempPath, buffer);
          console.log(`Saved to: ${tempPath} (${buffer.length} bytes)`);

          // Check if it's actually an XLSX file (should start with PK)
          const header = buffer.toString('ascii', 0, 2);
          console.log(`File header: ${header} (should be "PK" for XLSX)`);

          if (header !== 'PK') {
            // It's probably HTML, let's check
            const preview = buffer.toString('utf8', 0, 200);
            console.log(`File preview: ${preview.substring(0, 200)}`);
            reject(new Error('Downloaded file is not a valid XLSX file (probably HTML)'));
            return;
          }

          resolve(buffer);
        });
        response.on('error', reject);
      }).on('error', reject);
    };

    download(DFAT_URL);
  });
}

async function parseXLSX(buffer: Buffer): Promise<SanctionedEntity[]> {
  let entities: SanctionedEntity[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    console.log(`Found ${workbook.SheetNames.length} sheets:`, workbook.SheetNames);

    for (const sheetName of workbook.SheetNames) {
      console.log(`Processing sheet: ${sheetName}`);

      const sheet = workbook.Sheets[sheetName];
      const data: any[] = XLSX.utils.sheet_to_json(sheet);

      console.log(`Found ${data.length} rows in ${sheetName}`);

      for (const row of data) {
        const name = row['Name of Individual or Entity'] || '';
        const type = row['Type'] || '';

        if (!name || name.trim() === '') continue;

        const entityType = type.toLowerCase().includes('individual') ||
        type.toLowerCase() === 'person'
          ? 'individual'
          : 'entity';

        const aliases: string[] = [];
        const aliasStrength = row['Alias Strength'] || '';
        if (aliasStrength) {
          aliases.push(name);
        }

        const dob = row['Date of Birth'] || '';
        const citizenship = row['Citizenship'] || '';
        const reference = row['Reference'] || '';
        const listingInfo = row['Listing Information'] || '';
        const additionalInfo = row['Additional Information'] || '';
        const committees = row['Committees'] || '';
        const designation = row['Instrument of Designation'] || '';

        const fullListingInfo = [
          listingInfo,
          additionalInfo,
          committees ? `Committees: ${committees}` : '',
          designation ? `Designation: ${designation}` : '',
        ].filter(Boolean).join(' | ') || 'DFAT Consolidated List';

        entities.push({
          name: name.trim(),
          aliases: aliases,
          date_of_birth: dob ? formatDate(dob) : undefined,
          nationality: citizenship || undefined,
          entity_type: entityType,
          listing_info: fullListingInfo,
          reference_number: reference || `DFAT-${sheetName}-${entities.length}`,
        });
      }
    }

    entities = consolidateAliases(entities);
    console.log(`Parsed ${entities.length} total entities`);

  } catch (error) {
    console.error('Error parsing XLSX:', error);
    throw error;
  }

  return entities;
}

function consolidateAliases(entities: SanctionedEntity[]): SanctionedEntity[] {
  const grouped = new Map<string, SanctionedEntity>();

  for (const entity of entities) {
    const ref = entity.reference_number;

    if (grouped.has(ref)) {
      const existing = grouped.get(ref)!;
      if (entity.name !== existing.name) {
        existing.aliases.push(entity.name);
      }
      existing.aliases = [...new Set([...existing.aliases, ...entity.aliases])];
    } else {
      grouped.set(ref, entity);
    }
  }

  return Array.from(grouped.values());
}

function formatDate(dateValue: any): string | undefined {
  if (!dateValue) return undefined;

  try {
    if (typeof dateValue === 'number') {
      const date = XLSX.SSF.parse_date_code(dateValue);
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }

    if (typeof dateValue === 'string') {
      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
  } catch (error) {
    console.log(`Could not parse date: ${dateValue}`);
  }

  return undefined;
}

async function importToDatabase(entities: SanctionedEntity[]) {
  console.log(`Importing ${entities.length} sanctioned entities...`);

  const { error: deleteError } = await supabase
    .from('sanctioned_entities')
    .delete()
    .eq('source', 'DFAT');

  if (deleteError) {
    console.error('Error clearing old entries:', deleteError);
  } else {
    console.log('Cleared existing DFAT entries');
  }

  let successCount = 0;
  for (let i = 0; i < entities.length; i += 100) {
    const batch = entities.slice(i, i + 100);

    const { error } = await supabase
      .from('sanctioned_entities')
      .insert(
        batch.map(entity => ({
          full_name: entity.name,
          aliases: entity.aliases,
          date_of_birth: entity.date_of_birth,
          nationality: entity.nationality,
          entity_type: entity.entity_type,
          source: 'DFAT',
          reference_number: entity.reference_number,
          listing_info: entity.listing_info,
          last_updated: new Date().toISOString(),
        }))
      );

    if (error) {
      console.error(`Error importing batch ${i / 100 + 1}:`, error);
    } else {
      successCount += batch.length;
      console.log(`Imported batch ${i / 100 + 1} (${successCount}/${entities.length})`);
    }
  }

  console.log(`Import complete! Successfully imported ${successCount} entities`);
}

async function main() {
  try {
    console.log('📥 Downloading DFAT Consolidated List...');
    console.log(`URL: ${DFAT_URL}`);

    const buffer = await downloadDFATList();
    console.log(`✅ Downloaded ${buffer.length} bytes`);

    console.log('\n📊 Parsing XLSX...');
    const entities = await parseXLSX(buffer);

    if (entities.length === 0) {
      console.log('⚠️  No entities found in XLSX file');
      process.exit(1);
    }

    console.log('\n📋 Sample entities:');
    entities.slice(0, 3).forEach((entity, i) => {
      console.log(`\n${i + 1}. ${entity.name}`);
      console.log(`   Type: ${entity.entity_type}`);
      console.log(`   Reference: ${entity.reference_number}`);
      console.log(`   Aliases: ${entity.aliases.length > 0 ? entity.aliases.join(', ') : 'None'}`);
      if (entity.date_of_birth) console.log(`   DOB: ${entity.date_of_birth}`);
      if (entity.nationality) console.log(`   Nationality: ${entity.nationality}`);
    });

    console.log(`\n📊 Total entities to import: ${entities.length}`);
    console.log('⏳ Starting database import...\n');

    await importToDatabase(entities);

    console.log('\n✅ DFAT sanctions list imported successfully!');

    const individuals = entities.filter(e => e.entity_type === 'individual').length;
    const entitiesCount = entities.filter(e => e.entity_type === 'entity').length;
    console.log(`\n📈 Summary:`);
    console.log(`   - Individuals: ${individuals}`);
    console.log(`   - Entities: ${entitiesCount}`);
    console.log(`   - Total: ${entities.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n💡 Try manually downloading the file from:');
    console.log('   https://www.dfat.gov.au/international-relations/security/sanctions/pages/consolidated-list');
    console.log('   And place it in: src/scripts/dfat-download.xlsx');
    process.exit(1);
  }
}

main();