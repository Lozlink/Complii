-- Sanctioned entities table (shared across all tenants - updated centrally)
CREATE TABLE sanctioned_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    aliases TEXT[],
    date_of_birth DATE,
    nationality VARCHAR(100),
    entity_type VARCHAR(20) CHECK (entity_type IN ('individual', 'entity')),
    source VARCHAR(50) NOT NULL,
    reference_number VARCHAR(100),
    listing_info TEXT,
    search_vector TSVECTOR,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sanctioned_name ON sanctioned_entities(LOWER(full_name));
CREATE INDEX idx_sanctioned_source ON sanctioned_entities(source);
CREATE INDEX idx_sanctioned_search ON sanctioned_entities USING gin(search_vector);
CREATE INDEX idx_sanctioned_aliases ON sanctioned_entities USING gin(aliases);

-- Search vector trigger for full-text search
CREATE OR REPLACE FUNCTION update_sanctioned_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    NEW.full_name || ' ' ||
    COALESCE(array_to_string(NEW.aliases, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sanctioned_search_vector
    BEFORE INSERT OR UPDATE ON sanctioned_entities
    FOR EACH ROW
    EXECUTE FUNCTION update_sanctioned_search_vector();
