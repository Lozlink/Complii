'use client';

import { useState } from 'react';
import { Upload, Download, CheckCircle, XCircle, AlertTriangle, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface ImportResult {
  fileName: string;
  fileSize: number;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    succeeded: number;
    duplicates: number;
    failed: number;
  };
  results: Array<{
    rowNumber: number;
    status: 'success' | 'duplicate' | 'failed';
    error?: string;
    warnings?: string[];
  }>;
  invalidRows: Array<{
    rowNumber: number;
    errors: string[];
    data: Record<string, unknown>;
  }>;
  complianceProcessing: 'running' | 'skipped';
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [dryRun, setDryRun] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (skipDuplicates) formData.append('skipDuplicates', 'true');
      if (dryRun) formData.append('dryRun', 'true');

      const response = await fetch('/api/proxy/transactions/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Import failed');
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/proxy/transactions/import/template');
      const csv = await response.text();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'complii-transaction-import-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download template');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Bulk Transaction Import</h1>
        <p className="mt-2 text-gray-600">
          Import transactions from CSV or Excel files with automatic compliance checking
        </p>
      </div>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={downloadTemplate}
              className="flex items-center px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </button>
            <span className="text-sm text-gray-500">
              Download CSV template to see required columns
            </span>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
            <div className="text-center">
              <Upload className="w-12 h-12 mx-auto text-gray-400" />
              <div className="mt-4">
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  <span>Choose File</span>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                CSV, XLS, or XLSX up to 10MB (max 1,000 rows)
              </p>
            </div>
          </div>

          {file && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <FileText className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          )}

          {/* Options */}
          <div className="space-y-3 pt-4 border-t">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="w-4 h-4 text-primary border-gray-300 rounded"
              />
              <span className="ml-3 text-sm text-gray-700">
                Skip duplicate transactions (recommended)
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="w-4 h-4 text-primary border-gray-300 rounded"
              />
              <span className="ml-3 text-sm text-gray-700">
                Dry run (validate only, don't create transactions)
              </span>
            </label>
          </div>

          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {importing ? 'Importing...' : dryRun ? 'Validate File' : 'Import Transactions'}
          </button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Import Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{result.summary.succeeded}</div>
                  <div className="text-sm text-gray-500">Succeeded</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600">{result.summary.duplicates}</div>
                  <div className="text-sm text-gray-500">Duplicates</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">{result.summary.failed}</div>
                  <div className="text-sm text-gray-500">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-600">{result.summary.totalRows}</div>
                  <div className="text-sm text-gray-500">Total Rows</div>
                </div>
              </div>

              {result.complianceProcessing === 'running' && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center">
                  <AlertTriangle className="w-5 h-5 text-blue-600 mr-3" />
                  <p className="text-sm text-blue-800">
                    Compliance checks running in background. You'll receive alerts for any issues detected.
                  </p>
                </div>
              )}

              {dryRun && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Dry Run:</strong> No transactions were created. This was a validation run.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Failed/Invalid Rows */}
          {(result.summary.failed > 0 || result.invalidRows.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Failed Rows</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {result.invalidRows.map((row) => (
                    <div key={row.rowNumber} className="p-3 bg-red-50 border border-red-200 rounded">
                      <div className="flex items-start">
                        <XCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-red-900">Row {row.rowNumber}</p>
                          <ul className="mt-1 text-sm text-red-800 list-disc list-inside">
                            {row.errors.map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}

                  {result.results
                    .filter((r) => r.status === 'failed')
                    .map((row) => (
                      <div key={row.rowNumber} className="p-3 bg-red-50 border border-red-200 rounded">
                        <div className="flex items-start">
                          <XCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-red-900">Row {row.rowNumber}</p>
                            <p className="mt-1 text-sm text-red-800">{row.error}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Duplicates */}
          {result.summary.duplicates > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-yellow-600">Duplicate Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-3">
                  {result.summary.duplicates} transaction(s) were skipped because they already exist in the system.
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {result.results
                    .filter((r) => r.status === 'duplicate')
                    .slice(0, 10)
                    .map((row) => (
                      <div key={row.rowNumber} className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                        <AlertTriangle className="w-4 h-4 inline text-yellow-600 mr-2" />
                        Row {row.rowNumber} - Duplicate detected
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
