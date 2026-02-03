import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { RowData, ProcessResult } from './core';

export async function readCSV(filePath: string): Promise<{ headers: string[]; rows: RowData[] }> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const rows: RowData[] = [];
  let headers: string[] = [];

  return new Promise((resolve, reject) => {
    parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }, (err, records) => {
      if (err) {
        reject(err);
        return;
      }

      if (records.length > 0) {
        headers = Object.keys(records[0]);
      }

      for (let i = 0; i < records.length; i++) {
        rows.push({
          index: i,
          data: records[i],
          raw: Object.values(records[i])
        });
      }

      resolve({ headers, rows });
    });
  });
}

export async function readJSON(filePath: string): Promise<{ headers: string[]; rows: RowData[] }> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const data = JSON.parse(content);

  let records: any[];
  if (Array.isArray(data)) {
    records = data;
  } else if (data.data && Array.isArray(data.data)) {
    records = data.data;
  } else if (data.rows && Array.isArray(data.rows)) {
    records = data.rows;
  } else {
    records = [data];
  }

  const headers: string[] = records.length > 0 ? Object.keys(records[0]) : [];
  const rows: RowData[] = records.map((record, index) => ({
    index,
    data: record,
    raw: Object.values(record)
  }));

  return { headers, rows };
}

export async function readFile(filePath: string): Promise<{ headers: string[]; rows: RowData[]; format: 'csv' | 'json' }> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    const result = await readCSV(filePath);
    return { ...result, format: 'csv' };
  } else if (ext === '.json') {
    const result = await readJSON(filePath);
    return { ...result, format: 'json' };
  } else {
    throw new Error(`Unsupported file format: ${ext}. Use .csv or .json`);
  }
}

export async function writeCSV(
  filePath: string,
  headers: string[],
  results: ProcessResult[],
  outputColumn: string = 'ai_output'
): Promise<void> {
  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const outputHeaders = [...headers, outputColumn, '_success', '_error'];

  const records = results.map(result => {
    const row: Record<string, any> = { ...result.input };
    row[outputColumn] = result.output || '';
    row['_success'] = result.success ? 'true' : 'false';
    row['_error'] = result.error || '';
    return row;
  });

  return new Promise((resolve, reject) => {
    stringify(records, {
      header: true,
      columns: outputHeaders
    }, (err, output) => {
      if (err) {
        reject(err);
        return;
      }

      fs.writeFileSync(absolutePath, output);
      resolve();
    });
  });
}

export async function writeJSON(
  filePath: string,
  results: ProcessResult[],
  outputColumn: string = 'ai_output'
): Promise<void> {
  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const records = results.map(result => ({
    ...result.input,
    [outputColumn]: result.output || null,
    _meta: {
      success: result.success,
      error: result.error || null,
      duration: result.duration,
      index: result.index
    }
  }));

  fs.writeFileSync(absolutePath, JSON.stringify(records, null, 2));
}

export async function writeOutput(
  filePath: string,
  headers: string[],
  results: ProcessResult[],
  format: 'csv' | 'json',
  outputColumn: string = 'ai_output'
): Promise<void> {
  if (format === 'csv') {
    await writeCSV(filePath, headers, results, outputColumn);
  } else {
    await writeJSON(filePath, results, outputColumn);
  }
}

export function readTemplate(templatePath: string): string {
  const absolutePath = path.resolve(templatePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Template file not found: ${absolutePath}`);
  }

  return fs.readFileSync(absolutePath, 'utf-8').trim();
}

export function detectFormat(filePath: string): 'csv' | 'json' {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') return 'csv';
  if (ext === '.json') return 'json';

  // Default to CSV
  return 'csv';
}
