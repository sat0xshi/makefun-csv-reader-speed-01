// solve.js — a fast drop-in replacement for csv-reader 1.0.0's readCsv.
//
// Written from the published reading policy of csv-reader-speed-01: the answer for an input {text, header}
// is {columns, rows, errors}, read once, left to right, with commas and double quotes:
//   - a U+FEFF at the very start is dropped;
//   - a record ends at LF or CRLF; a line left with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled ("" inside it is one
//     quote; each CRLF or lone CR inside it is read as LF); what follows its closing quote, up to the
//     next comma or line break, is appended as it stands (quote_junk, when the field ends); a quote
//     that never closes is a literal character and the text after it is read again as unquoted
//     (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay strings, never trimmed;
//   - columns is the first record when header is true, else null; rows holds the records after it,
//     each padded with "" (short_row, with fields: its count) or cut (long_row, with extra: the cut
//     fields) to the first record's width;
//   - each error is {code, line, row} in the order met: line the 1-based line its record starts on
//     (every LF, CRLF and lone CR inside quotes counted), row its record's index in rows, null for
//     the header.
//
// Where the reference walks one character at a time and grows each field a character at a time, this
// reader scans with charCodeAt and builds each field from whole slices of the text between special
// characters, so the common field costs one slice and no per-character work. Pure: no clock, no
// randomness, nothing kept from one call to the next.

const COMMA_END = 0;
const BREAK_END = 1;
const TEXT_END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  const n = text.length;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The field last read, in shared slots so a field costs no allocation.
  let fValue = '';
  let fEnded = TEXT_END;
  let fAdded = 0;

  // Reads unquoted characters onto `value` up to the next comma or line break: a CR not followed by
  // LF is dropped (stray_cr). Sets fValue, fEnded and fAdded (the characters this call kept).
  function readUnquoted(value) {
    let added = 0;
    let seg = pos;
    let i = pos;
    while (i < n) {
      const cc = text.charCodeAt(i);
      if (cc === 44) { // ,
        fValue = value + text.slice(seg, i);
        fAdded = added + (i - seg);
        fEnded = COMMA_END;
        pos = i + 1;
        return;
      }
      if (cc === 10) { // LF
        fValue = value + text.slice(seg, i);
        fAdded = added + (i - seg);
        fEnded = BREAK_END;
        pos = i + 1;
        line += 1;
        return;
      }
      if (cc === 13) { // CR
        if (text.charCodeAt(i + 1) === 10) { // CRLF
          fValue = value + text.slice(seg, i);
          fAdded = added + (i - seg);
          fEnded = BREAK_END;
          pos = i + 2;
          line += 1;
          return;
        }
        value += text.slice(seg, i);
        added += i - seg;
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        i += 1;
        seg = i;
        continue;
      }
      i += 1;
    }
    fValue = value + text.slice(seg, n);
    fAdded = added + (n - seg);
    fEnded = TEXT_END;
    pos = n;
  }

  // Reads a quoted field whose opening quote is at pos. Sets fValue and fEnded.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let i = pos + 1;
    let seg = i;
    let value = '';
    let closed = false;
    while (i < n) {
      const cc = text.charCodeAt(i);
      if (cc === 34) { // "
        if (text.charCodeAt(i + 1) === 34) { // "" is one quote
          value += text.slice(seg, i) + '"';
          i += 2;
          seg = i;
          continue;
        }
        value += text.slice(seg, i);
        i += 1;
        closed = true;
        break;
      }
      if (cc === 13) { // CRLF and a lone CR inside quotes are each one LF
        value += text.slice(seg, i) + '\n';
        line += 1;
        i += text.charCodeAt(i + 1) === 10 ? 2 : 1;
        seg = i;
        continue;
      }
      if (cc === 10) line += 1; // an LF inside quotes stays an LF in the field
      i += 1;
    }
    if (!closed) {
      // The quote never closes: it is a literal character, and the text after it is read again as
      // unquoted, from the start, on the line the field opened on.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      readUnquoted('"');
      return;
    }
    pos = i;
    if (pos >= n) {
      fValue = value;
      fEnded = TEXT_END;
      return;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      fValue = value;
      fEnded = COMMA_END;
      return;
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      fValue = value;
      fEnded = BREAK_END;
      return;
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      fValue = value;
      fEnded = BREAK_END;
      return;
    }
    // What follows the closing quote is appended as it stands, up to the next comma or line break.
    readUnquoted(value);
    if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const cc = text.charCodeAt(pos);
      if (cc === 10) {
        pos += 1;
        line += 1;
      } else if (cc === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) {
        readQuoted();
        fields.push(fValue);
      } else {
        // The common field, inlined: unquoted text up to the next comma or line break, built from
        // whole slices; a CR not followed by LF is dropped (stray_cr). readUnquoted above is this
        // same reading, kept for the two rare paths that reach it with a value already in hand
        // (after a closing quote, and after a quote that never closes).
        let value = '';
        let seg = pos;
        let i = pos;
        let ended = -1;
        while (i < n) {
          const cc = text.charCodeAt(i);
          if (cc === 44) {
            value += text.slice(seg, i);
            pos = i + 1;
            ended = COMMA_END;
            break;
          }
          if (cc === 10) {
            value += text.slice(seg, i);
            pos = i + 1;
            line += 1;
            ended = BREAK_END;
            break;
          }
          if (cc === 13) {
            if (text.charCodeAt(i + 1) === 10) {
              value += text.slice(seg, i);
              pos = i + 2;
              line += 1;
              ended = BREAK_END;
              break;
            }
            value += text.slice(seg, i);
            errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
            i += 1;
            seg = i;
            continue;
          }
          i += 1;
        }
        if (ended < 0) {
          value += text.slice(seg, n);
          pos = n;
          ended = TEXT_END;
        }
        fEnded = ended;
        fields.push(value);
      }
    } while (fEnded === COMMA_END);

    // A line that held only stray CRs is left with no characters: no record (its errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
