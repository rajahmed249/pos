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
      // Handle SQL doubled single quotes '' inside strings
      if (inString && valuesPart[i + 1] === "'") {
        currentField += "\\'";
        i++;
        continue;
      }
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

function extractCreateTableSchemas(content: string): Record<string, string[]> {
  const schemas: Record<string, string[]> = {};
  const createRegex = /CREATE TABLE(?: IF NOT EXISTS)? `([a-zA-Z0-9_]+)`\s*\(([\s\S]*?)\)\s*ENGINE=/gi;
  let match: RegExpExecArray | null;

  while ((match = createRegex.exec(content)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const cols: string[] = [];
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim();
      const colMatch = line.match(/^`([^`]+)`\s+/);
      if (colMatch) {
        cols.push(colMatch[1]);
      }
    }
    if (cols.length > 0) {
      schemas[tableName] = cols;
    }
  }

  return schemas;
}

function findStatementEnd(content: string, startIdx: number): number {
  let inString = false;
  let escapeNext = false;
  for (let i = startIdx; i < content.length; i++) {
    const ch = content[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    if (ch === "'") {
      if (inString && content[i + 1] === "'") {
        i++;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (!inString && ch === ';') {
      return i;
    }
  }

  // Fallback recovery if an unescaped quote inside a string prevented finding ';'
  // Look for mysqldump block end markers like ");\n/*!40000 ALTER TABLE" or ";\nUNLOCK TABLES"
  const tail = content.slice(startIdx);
  const boundaryMatch = tail.match(/;\r?\n(?:\/\*!40000 ALTER TABLE|UNLOCK TABLES;|DROP TABLE IF EXISTS|CREATE TABLE|INSERT(?:\s+IGNORE)?\s+INTO)/);
  if (boundaryMatch && boundaryMatch.index !== undefined) {
    return startIdx + boundaryMatch.index;
  }

  return -1;
}

export function parseMysqlDumpText(content: string): {
  tables: Record<string, SqlRow[]>;
  schemas: Record<string, string[]>;
  truncated: boolean;
  incompleteTables: string[];
} {
  const schemas = extractCreateTableSchemas(content);
  const tables: Record<string, SqlRow[]> = {};
  const incompleteTables: string[] = [];
  let truncated = false;

  const insertHeadRegex = /INSERT(?:\s+IGNORE)?\s+INTO `([a-zA-Z0-9_]+)`(?:\s*\(([^)]+)\))?\s+VALUES\s*/gi;
  let match: RegExpExecArray | null;

  while ((match = insertHeadRegex.exec(content)) !== null) {
    const tableName = match[1];
    const explicitCols = match[2];
    const valuesStart = match.index + match[0].length;
    const stmtEnd = findStatementEnd(content, valuesStart);

    if (stmtEnd === -1) {
      truncated = true;
      incompleteTables.push(tableName);
      break;
    }

    insertHeadRegex.lastIndex = stmtEnd + 1;

    if (tableName.includes('backup')) {
      continue;
    }

    const columns = explicitCols
      ? explicitCols.split(',').map((c) => c.trim().replace(/^`|`$/g, ''))
      : (schemas[tableName] ?? []);

    if (columns.length === 0) {
      continue;
    }

    const valuesPart = content.slice(valuesStart, stmtEnd);
    const tuples = splitTuples(valuesPart);

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

  return { tables, schemas, truncated, incompleteTables };
}

export function parseMysqlDump(sqlPath: string): Record<string, SqlRow[]> {
  const content = fs.readFileSync(sqlPath, 'utf8');
  return parseMysqlDumpText(content).tables;
}
