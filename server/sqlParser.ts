import fs from 'node:fs';

export type SqlRow = Record<string, string | number | null>;

function parseValueToken(raw: string): string | number | null {
  const trimmed = raw.trim();
  if (trimmed.toUpperCase() === 'NULL') {
    return null;
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    const inner = trimmed.slice(1, -1);
    return inner
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : trimmed;
  }
  return trimmed;
}

function splitTuples(valuesPart: string): string[][] {
  const rows: string[][] = [];
  let inString = false;
  let escapeNext = false;
  let depth = 0;
  let currentField = '';
  let currentRow: string[] = [];

  for (let i = 0; i < valuesPart.length; i++) {
    const ch = valuesPart[i];

    if (escapeNext) {
      currentField += ch;
      escapeNext = false;
      continue;
    }

    if (ch === '\\' && inString) {
      currentField += ch;
      escapeNext = true;
      continue;
    }

    if (ch === "'") {
      inString = !inString;
      currentField += ch;
      continue;
    }

    if (!inString) {
      if (ch === '(') {
        if (depth === 0) {
          currentRow = [];
          currentField = '';
        } else {
          currentField += ch;
        }
        depth++;
        continue;
      }

      if (ch === ')') {
        depth--;
        if (depth === 0) {
          currentRow.push(currentField);
          rows.push(currentRow);
          currentField = '';
        } else {
          currentField += ch;
        }
        continue;
      }

      if (ch === ',' && depth === 1) {
        currentRow.push(currentField);
        currentField = '';
        continue;
      }
    }

    if (depth >= 1) {
      currentField += ch;
    }
  }

  return rows;
}

export function parseMysqlDump(sqlPath: string): Record<string, SqlRow[]> {
  const content = fs.readFileSync(sqlPath, 'utf8');
  const tables: Record<string, SqlRow[]> = {};

  const insertRegex = /INSERT INTO `([a-zA-Z0-9_]+)` \(([^)]+)\) VALUES\s*([\s\S]*?);\s*(?=\n|$)/g;
  let match: RegExpExecArray | null;

  while ((match = insertRegex.exec(content)) !== null) {
    const tableName = match[1];
    if (tableName.includes('backup')) {
      continue;
    }

    const columns = match[2]
      .split(',')
      .map((c) => c.trim().replace(/^`|`$/g, ''));

    const tuples = splitTuples(match[3]);
    if (!tables[tableName]) {
      tables[tableName] = [];
    }

    for (const tuple of tuples) {
      const row: SqlRow = {};
      for (let idx = 0; idx < columns.length; idx++) {
        row[columns[idx]] = idx < tuple.length ? parseValueToken(tuple[idx]) : null;
      }
      tables[tableName].push(row);
    }
  }

  return tables;
}
