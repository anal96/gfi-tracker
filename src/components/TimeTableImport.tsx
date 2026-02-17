import { useState, useCallback, useEffect } from 'react';
import { Upload, Download, AlertCircle, FileSpreadsheet, Send, Loader2, History, X, Trash2, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import api from '../services/api';

const VALID_SLOT_IDS = ['9-10', '10-11', '11-12', '12-13', '13-14', '14-15', '15-16', '16-17'];
const CLASS_SCHEDULE_HEADERS = ['DATE', 'DAY', 'BATCH', 'SUBJECT', 'FACULTY', 'EMAIL', 'TIME'];
const REQUIRED_COLUMNS = ['DATE', 'DAY', 'BATCH', 'SUBJECT', 'FACULTY', 'EMAIL', 'TIME'];

export interface ValidationError {
  rowIndex: number; // 1-based for display (header = 0)
  column: string;
  message: string;
}

export interface TimeTableEntry {
  teacherName: string;
  teacherEmail: string;
  date: string;
  slotIds: string[];
  breakMinutes: number | null;
  day?: string;
  timeDisplay?: string;
  batch?: string;
  subject?: string;
  resolvedTeacherName?: string;
  resolvedTeacherEmail?: string;
}

function validateHeaders(headerRow: string[]): string[] {
  const normalized = headerRow.map(h => String(h).trim().toUpperCase());
  const missing = REQUIRED_COLUMNS.filter(col => !normalized.includes(col));
  return missing;
}

function validateOneRow(entry: TimeTableEntry, rowIndex: number, options?: { requireResolvedEmail?: boolean }): ValidationError[] {
  const errors: ValidationError[] = [];
  const rowNum = rowIndex + 2; // 1-based + header row

  if (!entry.date || entry.date.trim() === '') {
    errors.push({ rowIndex: rowNum, column: 'DATE', message: 'Date is required' });
  } else {
    const d = new Date(entry.date);
    if (isNaN(d.getTime())) {
      errors.push({ rowIndex: rowNum, column: 'DATE', message: 'Invalid date format' });
    }
  }

  if (!entry.teacherName?.trim() && !entry.teacherEmail?.trim()) {
    errors.push({ rowIndex: rowNum, column: 'FACULTY / EMAIL', message: 'Faculty name or Email is required' });
  }

  if (options?.requireResolvedEmail && !entry.teacherEmail?.trim()) {
    errors.push({ rowIndex: rowNum, column: 'EMAIL', message: 'Teacher email is required (fill EMAIL or ensure faculty name matches a teacher)' });
  }

  if (!entry.subject?.trim()) {
    errors.push({ rowIndex: rowNum, column: 'SUBJECT', message: 'Subject is required' });
  }

  if (!entry.slotIds?.length) {
    errors.push({ rowIndex: rowNum, column: 'TIME', message: 'Time range is required and must parse to at least one slot (e.g. 9.30 - 4.30)' });
  }

  return errors;
}

function validateEntriesForSend(entries: TimeTableEntry[], requireResolvedEmail = false): ValidationError[] {
  const all: ValidationError[] = [];
  entries.forEach((e, i) => {
    all.push(...validateOneRow(e, i, { requireResolvedEmail }));
  });
  return all;
}

type RefData = {
  teachers: Array<{ teacherId: string; teacherName: string; teacherEmail: string }>;
  subjects: Array<{ _id: string; name: string }>;
  batches: Array<{ _id: string; name: string }>;
};

function validateRowAgainstRef(
  entry: TimeTableEntry,
  rowIndex: number,
  ref: RefData
): ValidationError[] {
  const errors: ValidationError[] = [];
  const rowNum = rowIndex + 2;

  const email = (entry.teacherEmail || '').trim().toLowerCase();
  const faculty = (entry.teacherName || '').trim();
  const teacherByEmail = ref.teachers.find(t => (t.teacherEmail || '').trim().toLowerCase() === email);
  const teacherByName = ref.teachers.find(t => {
    const n = (t.teacherName || '').trim();
    return n.toLowerCase() === faculty.toLowerCase() ||
      n.toLowerCase().includes(faculty.toLowerCase()) ||
      faculty.toLowerCase().includes(n.toLowerCase());
  });
  if (!teacherByEmail && !teacherByName) {
    if (email) {
      errors.push({ rowIndex: rowNum, column: 'EMAIL', message: `Teacher not found with email "${entry.teacherEmail}". Add them in the app or use a valid teacher email.` });
    } else if (faculty) {
      errors.push({ rowIndex: rowNum, column: 'FACULTY', message: `Teacher not found: "${faculty}". Add them in the app or fill EMAIL with their login email.` });
    }
  }

  const subjectName = (entry.subject || '').trim();
  if (subjectName) {
    const subjectExists = ref.subjects.some(s => (s.name || '').trim().toLowerCase() === subjectName.toLowerCase());
    if (!subjectExists) {
      errors.push({ rowIndex: rowNum, column: 'SUBJECT', message: `Subject "${subjectName}" does not exist. Create it in the app or use a valid subject name.` });
    }
  }

  const batchName = (entry.batch || '').trim();
  if (batchName) {
    const batchExists = ref.batches.some(b => (b.name || '').trim().toLowerCase() === batchName.toLowerCase());
    if (!batchExists) {
      errors.push({ rowIndex: rowNum, column: 'BATCH', message: `Batch "${batchName}" does not exist. Create it in the app or use a valid batch name.` });
    }
  } else {
    errors.push({ rowIndex: rowNum, column: 'BATCH', message: 'Batch is required and must exist in the app.' });
  }

  return errors;
}

export function TimeTableImport() {
  const [entries, setEntries] = useState<TimeTableEntry[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validating, setValidating] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResult, setApplyResult] = useState<{ applied: number; errors?: Array<{ entry: any; message: string }> } | null>(null);

  // History State
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);


  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await api.getTimeTableHistory();
      if (response && response.success) {
        setHistoryData(response.data);
      }
    } catch (error) {
      console.error('Failed to load history', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this history record? This will NOT remove the actual time table slots from calendars, only this upload log.')) {
      return;
    }

    try {
      await api.deleteTimeTableHistory(id);
      setHistoryData(prev => prev.filter(item => item._id !== id));
    } catch (err) {
      console.error('Failed to delete history', err);
      alert('Failed to delete history record');
    }
  };

  const handleDownloadHistory = (item: any) => {
    try {
      if (!item.entries || item.entries.length === 0) return;

      const exportData = item.entries.map((e: any) => {
        let dayStr = e.day || '';
        if (!dayStr && e.date) {
          try { dayStr = new Date(e.date).toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(); } catch (err) { }
        }

        return {
          'DATE': e.date,
          'DAY': dayStr,
          'BATCH': e.batch || '',
          'SUBJECT': e.subject || e.subjectName || '',
          'FACULTY': e.teacherName || e.resolvedTeacherName || e.teacherEmail || '',
          'SENT TO': e.resolvedTeacherName || e.teacherName || '',
          'EMAIL': e.teacherEmail || '',
          'TIME': e.timeDisplay || (e.slotIds && e.slotIds.length > 0 ? `${e.slotIds.length} slots` : '')
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData, { header: CLASS_SCHEDULE_HEADERS });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sent Time Table');
      const dateStr = new Date(item.createdAt).toISOString().split('T')[0];
      XLSX.writeFile(wb, `Sent_TimeTable_${dateStr}.xlsx`);
    } catch (err) {
      console.error('Download failed', err);
      alert('Failed to generate Excel file');
    }
  };

  // When entries change: run format validation, then fetch teachers/subjects/batches and validate existence
  // Also resolve teacher details if missing (e.g. name based on email, or email based on name)
  useEffect(() => {
    if (entries.length === 0) {
      setValidationErrors([]);
      setValidating(false);
      return;
    }
    const formatErrors = validateEntriesForSend(entries);
    setValidating(true);
    let cancelled = false;
    (async () => {
      try {
        const [teachersRes, subjectsRes, batchesRes] = await Promise.all([
          api.getAvailableTeachers(null),
          api.getVerifierSubjects(null),
          api.getBatches()
        ]);
        if (cancelled) return;

        const teachers: RefData['teachers'] = (teachersRes?.data ?? teachersRes) ?? [];
        const subjects: RefData['subjects'] = (subjectsRes?.data ?? subjectsRes) ?? [];
        const batches: RefData['batches'] = (batchesRes?.data ?? batchesRes) ?? [];
        const ref: RefData = { teachers, subjects, batches };

        // Resolve teacher details in entries
        const resolvedEntries = entries.map(entry => {
          let resolved = { ...entry };
          const email = (entry.teacherEmail || '').trim().toLowerCase();
          const faculty = (entry.teacherName || '').trim();

          if (email) {
            const match = teachers.find(t => (t.teacherEmail || '').trim().toLowerCase() === email);
            if (match) {
              resolved.teacherName = match.teacherName || resolved.teacherName;
              resolved.resolvedTeacherName = match.teacherName;
              resolved.resolvedTeacherEmail = match.teacherEmail;
            }
          } else if (faculty) {
            const match = teachers.find(t => {
              const n = (t.teacherName || '').trim();
              return n.toLowerCase() === faculty.toLowerCase() ||
                n.toLowerCase().includes(faculty.toLowerCase()) ||
                faculty.toLowerCase().includes(n.toLowerCase());
            });
            if (match) {
              resolved.teacherEmail = match.teacherEmail || resolved.teacherEmail;
              resolved.resolvedTeacherName = match.teacherName;
              resolved.resolvedTeacherEmail = match.teacherEmail;
            }
          }
          return resolved;
        });

        // Only update entries if resolution changed something to avoid infinite loop
        const hasChanges = JSON.stringify(resolvedEntries) !== JSON.stringify(entries);
        if (hasChanges) {
          setEntries(resolvedEntries);
          // Verify one more time with resolved data in next render cycle or continue validation on resolved data?
          // To prevent double render/validation loop, we continue validation on `resolvedEntries` locally
          // but `setEntries` will trigger effect again. To avoid loop, we check equality.
        }

        const existenceErrors: ValidationError[] = [];
        // Validate using the (potentially) resolved entries
        const targetEntries = hasChanges ? resolvedEntries : entries;

        targetEntries.forEach((e, i) => {
          existenceErrors.push(...validateRowAgainstRef(e, i, ref));
        });
        setValidationErrors([...formatErrors, ...existenceErrors]);
      } catch (err: any) {
        if (!cancelled) {
          setValidationErrors([
            ...formatErrors,
            { rowIndex: 0, column: 'Validation', message: `Could not load reference data: ${err?.message || 'Network error'}. Fix and try again.` }
          ]);
        }
      } finally {
        if (!cancelled) setValidating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entries]);

  const downloadTemplate = useCallback(() => {
    const wsData = [
      CLASS_SCHEDULE_HEADERS,
      ['26/1/2026', 'MONDAY', 'CMA INTER JUNE 2026', '', 'CELEBRATION DAY', '', ''],
      ['27/1/2026', 'TUESDAY', 'CMA INTER JUNE 2026', 'FM', 'CMA BIJU T J', 'teacher@example.com', '9.30 - 4.30'],
      ['28/1/2026', 'WEDNESDAY', 'CMA INTER JUNE 2026', 'FM', 'CMA BIJU T J', 'teacher@example.com', '9.30 - 4.30'],
      ['29/1/2026', 'THURSDAY', 'CMA INTER JUNE 2026', 'FM', 'CMA BIJU T J', 'teacher@example.com', '9.30 - 4.30'],
      ['30/1/2026', 'FRIDAY', 'CMA INTER JUNE 2026', 'FM', 'CMA BIJU T J', 'teacher@example.com', '9.30 - 4.30'],
      ['31/1/2026', 'SATURDAY', 'CMA INTER JUNE 2026', 'FM', 'CMA BIJU T J', 'teacher@example.com', '9.30 - 4.30'],
      ['1/2/2026', 'SUNDAY', 'CMA INTER JUNE 2026', '', 'WEEK OFF', '', '']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Time Table');
    XLSX.writeFile(wb, 'time-table-template.xlsx');
  }, []);

  const parseSlotString = (value: string): string[] => {
    if (!value || typeof value !== 'string') return [];
    return value
      .split(/[,;\s]+/)
      .map(s => s.trim())
      .filter(id => VALID_SLOT_IDS.includes(id));
  };

  /** Convert time range like "9.30 - 4.30" (9:30 AM–4:30 PM) to slot IDs (9-10 through 16-17) */
  const parseTimeRangeToSlots = (value: string): string[] => {
    if (!value || typeof value !== 'string') return [];
    const trimmed = value.trim();
    const match = trimmed.match(/(\d{1,2})[.:]?\s*(\d{0,2})\s*[-–—]\s*(\d{1,2})[.:]?\s*(\d{0,2})/i);
    if (!match) return [];
    const startH = parseInt(match[1], 10);
    const startM = parseInt(match[2] || '0', 10);
    let endH = parseInt(match[3], 10);
    const endM = parseInt(match[4] || '0', 10);
    if (endH < 12 && endH <= startH) endH += 12;
    const startSlot = startH;
    const endSlot = endH + (endM > 0 ? 1 : 0);
    const slots: string[] = [];
    for (let h = startSlot; h < endSlot; h++) {
      const id = `${h}-${h + 1}`;
      if (VALID_SLOT_IDS.includes(id)) slots.push(id);
    }
    return slots;
  };

  const parseDateCell = (dateRaw: unknown): string => {
    if (dateRaw == null) return '';
    if (typeof dateRaw === 'number') {
      const utc = (dateRaw - 25569) * 86400 * 1000;
      const d = new Date(utc);
      if (isNaN(d.getTime())) return '';
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    const str = String(dateRaw).trim();
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (dmy) {
      const d = parseInt(dmy[1], 10);
      const m = parseInt(dmy[2], 10) - 1;
      const y = parseInt(dmy[3], 10);
      const year = y < 100 ? 2000 + y : y;
      const date = new Date(year, m, d);
      if (isNaN(date.getTime())) return '';
      return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    }
    return str.split('T')[0];
  };

  const parseBreak = (value: unknown): number | null => {
    if (value == null || value === '') return null;
    const n = Number(value);
    if (Number.isNaN(n)) return null;
    if ([15, 30, 45, 60].includes(n)) return n;
    return Math.min(60, Math.max(0, Math.round(n)));
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setApplyResult(null);
    setUploadError(null);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data) throw new Error('Failed to read file');
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1 }) as (string | number)[][];
        if (rows.length < 2) {
          setUploadError('File must have a header row and at least one data row.');
          setEntries([]);
          return;
        }

        const headerRow = rows[0].map(String);
        const missingCols = validateHeaders(headerRow);
        if (missingCols.length > 0) {
          setUploadError(`Missing required columns: ${missingCols.join(', ')}. File must have all: ${REQUIRED_COLUMNS.join(', ')}.`);
          setEntries([]);
          return;
        }

        const header = headerRow.map(h => h.toLowerCase().trim());
        const dateIdx = header.findIndex(h => h === 'date');
        const dayIdx = header.findIndex(h => h === 'day');
        const batchIdx = header.findIndex(h => h === 'batch');
        const subjectIdx = header.findIndex(h => h === 'subject');
        const timeIdx = header.findIndex(h => h === 'time');
        const facultyIdx = header.findIndex(h => h === 'faculty');
        const emailIdx = header.findIndex(h => h === 'email' || h === 'teacher email');

        const parsed: TimeTableEntry[] = [];

        // Helper variables for merged cells
        let lastDate = '';
        let lastDay = '';
        let lastBatch = '';
        let lastSubject = '';
        let lastTimeStr = '';
        let lastFaculty = '';
        let lastEmail = '';


        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row)) continue;

          const firstCell = String(row[0] ?? '').trim().toUpperCase();
          if (firstCell === 'BREAK') continue;

          // Extract current row values
          let date = parseDateCell(row[dateIdx]);
          let timeStr = String(row[timeIdx] ?? '').trim();
          let faculty = String(row[facultyIdx] ?? '').trim();
          let day = dayIdx >= 0 ? String(row[dayIdx] ?? '').trim() : '';
          let batch = batchIdx >= 0 ? String(row[batchIdx] ?? '').trim() : '';
          let subject = subjectIdx >= 0 ? String(row[subjectIdx] ?? '').trim() : '';
          let email = emailIdx >= 0 ? String(row[emailIdx] ?? '').trim() : '';

          // Handle merged cells logic (carry over from previous if empty)
          if (date) lastDate = date; else date = lastDate;
          if (day) lastDay = day; else day = lastDay;
          if (batch) lastBatch = batch; else batch = lastBatch; // Key fix for missing Batch
          if (subject) lastSubject = subject; else subject = lastSubject; // Key fix for missing Subject

          // Time/Faculty/Email are usually row-specific but sometimes merged differently
          // If time is present, it's a new slot. We do NOT carry over time because merged time cells (e.g. "9-12") 
          // are processed fully in the first row. Carrying it over would duplicate the 3-hour block for every underlying empty row.

          // Faculty/Email carry over only if it looks like a merged block (e.g. same subject/time)
          // But actually, simpler approach: if the cell is literally empty, take previous. 
          // Warning: This assumes the empty cell MEANS "same as above".
          if (faculty) lastFaculty = faculty; else faculty = lastFaculty;
          if (email) lastEmail = email; else email = lastEmail;


          if (!date || !faculty) continue;
          if (!timeStr || /CELEBRATION|WEEK OFF|OFF/i.test(faculty)) continue;

          const slotIds = parseTimeRangeToSlots(timeStr);
          if (slotIds.length === 0) continue;

          parsed.push({
            teacherName: faculty,
            teacherEmail: email,
            date,
            slotIds,
            breakMinutes: null,
            day: day || undefined,
            timeDisplay: timeStr || undefined,
            batch: batch || undefined,
            subject: subject || undefined
          });
        }
        setEntries(parsed);
        if (parsed.length === 0) {
          setUploadError('No valid rows found. Use DATE, DAY, BATCH, SUBJECT, FACULTY, EMAIL, TIME (e.g. 9.30 - 4.30). Skip WEEK OFF / CELEBRATION rows.');
        }
      } catch (err: any) {
        setUploadError(err.message || 'Invalid Excel file.');
        setEntries([]);
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleApproveAndSend = useCallback(async () => {
    if (entries.length === 0) return;
    if (validating) return;
    if (validationErrors.length > 0) {
      setApplyResult({ applied: 0, errors: validationErrors.map(e => ({ entry: null, message: `Row ${e.rowIndex} (${e.column}): ${e.message}` })) });
      return;
    }
    setApplyLoading(true);
    setApplyResult(null);
    try {
      let resolvedEntries = entries;
      const needsResolve = entries.some(e => e.teacherName && !e.teacherEmail);
      if (needsResolve) {
        const teachersRes = await api.getAvailableTeachers(null);
        const teachers: Array<{ teacherId: string; teacherName: string; teacherEmail: string }> = (teachersRes?.data ?? teachersRes) ?? [];
        const errors: Array<{ entry: any; message: string }> = [];
        resolvedEntries = entries
          .map(e => {
            if (e.teacherEmail) return e;
            const name = (e.teacherName || '').trim();
            const match = teachers.find(
              t => (t.teacherName || '').trim().toLowerCase() === name.toLowerCase() ||
                (t.teacherName || '').toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes((t.teacherName || '').toLowerCase())
            );
            if (match) return { ...e, teacherEmail: match.teacherEmail };
            errors.push({ entry: e, message: `Teacher not found: "${name}". Add them in the app or use Teacher Email in the sheet.` });
            return null;
          })
          .filter((e): e is TimeTableEntry => e != null);
        if (errors.length > 0) {
          setApplyResult({ applied: 0, errors });
          setApplyLoading(false);
          return;
        }
      }
      const sendValidation = validateEntriesForSend(resolvedEntries, true);
      if (sendValidation.length > 0) {
        setApplyResult({ applied: 0, errors: sendValidation.map(e => ({ entry: null, message: `Row ${e.rowIndex} (${e.column}): ${e.message}` })) });
        setApplyLoading(false);
        return;
      }
      const payload = resolvedEntries.map(e => ({
        teacherEmail: e.teacherEmail,
        teacherName: e.teacherName,
        date: e.date,
        day: e.day,
        slotIds: e.slotIds,
        breakMinutes: e.breakMinutes ?? undefined,
        subjectName: e.subject ?? undefined,
        batch: e.batch ?? undefined,
        timeDisplay: e.timeDisplay
      }));
      const response = await api.applyTimeTableFromImport(payload);
      if (response && response.success) {
        setApplyResult({ applied: response.applied ?? 0, errors: response.errors });
        if (response.applied > 0) setEntries([]);
      } else {
        setApplyResult({ applied: 0, errors: [{ entry: null, message: response?.message || 'Failed to apply' }] });
      }
    } catch (err: any) {
      setApplyResult({ applied: 0, errors: [{ entry: null, message: err.message || 'Request failed' }] });
    } finally {
      setApplyLoading(false);
    }
  }, [entries, validating, validationErrors]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-black dark:text-white mb-1">Import Time Table from Excel</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Use the template (DATE, DAY, BATCH, SUBJECT, FACULTY, EMAIL, TIME). Fill each teacher&apos;s login email so their timetable is added to their calendar.
          </p>
        </div>
        <button
          onClick={() => {
            setShowHistory(!showHistory);
            if (!showHistory) fetchHistory();
          }}
          className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'}`}
          title="View Sent History"
        >
          <History className="w-5 h-5" />
        </button>
      </div>

      {showHistory && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800/50 p-4 max-h-80 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4" />
              Sent History
            </h4>
            <button onClick={() => setShowHistory(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          {loadingHistory ? (
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : historyData.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No history found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 rounded-tl-lg">Date</th>

                    <th className="px-4 py-2 rounded-tr-lg text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {historyData.map((item: any) => (
                    <>
                      <tr key={item._id} className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleDateString()}
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                            {new Date(item.createdAt).toLocaleTimeString()}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right flex items-center justify-end gap-2">

                          <button
                            onClick={() => handleDownloadHistory(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-blue-200 dark:border-blue-800"
                            title="Download Excel"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            Excel
                          </button>
                          <button
                            onClick={() => handleDeleteHistory(item._id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded-lg transition-colors border border-red-200 dark:border-red-800"
                            title="Delete History Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </td>
                      </tr>

                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="p-6 space-y-6">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <Download className="w-5 h-5" />
            Download template (DATE, DAY, BATCH, SUBJECT, FACULTY, EMAIL, TIME)
          </button>
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors cursor-pointer">
            <Upload className="w-5 h-5" />
            Upload Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {uploadError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {uploadError}
          </div>
        )}

        {validating && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-sm">
            <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
            Analyzing data… Checking teachers, subjects, and batches exist in the app.
          </div>
        )}
        {!validating && validationErrors.length > 0 && (
          <div className="flex flex-col gap-2 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              Validation failed: {validationErrors.length} error(s). Fix the file and re-upload. Data will not be sent until all rows pass.
            </p>
            <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside space-y-0.5 max-h-40 overflow-y-auto">
              {validationErrors.map((err, i) => (
                <li key={i}>
                  Row {err.rowIndex} ({err.column}): {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {entries.length > 0 && (
          <>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preview ({entries.length} row{entries.length !== 1 ? 's' : ''}) — no changes saved until you approve
                {validating && (
                  <span className="ml-2 text-blue-600 dark:text-blue-400 font-semibold">· Analyzing…</span>
                )}
                {!validating && validationErrors.length > 0 && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400 font-semibold">· Validation errors: send disabled</span>
                )}
              </p>
              <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium text-gray-700 dark:text-gray-300">Date</th>
                      <th className="text-left p-2 font-medium text-gray-700 dark:text-gray-300">Day</th>
                      <th className="text-left p-2 font-medium text-gray-700 dark:text-gray-300">Batch</th>
                      <th className="text-left p-2 font-medium text-gray-700 dark:text-gray-300">Subject</th>
                      <th className="text-left p-2 font-medium text-gray-700 dark:text-gray-300">Faculty</th>
                      <th className="text-left p-2 font-medium text-gray-700 dark:text-gray-300">Email</th>
                      <th className="text-left p-2 font-medium text-gray-700 dark:text-gray-300">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((row, idx) => (
                      <tr key={`${row.teacherEmail || row.teacherName}-${row.date}-${idx}`} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="p-2 text-gray-700 dark:text-gray-300">{row.date}</td>
                        <td className="p-2 text-gray-700 dark:text-gray-300">{row.day || '—'}</td>
                        <td className="p-2 text-gray-700 dark:text-gray-300">{row.batch || '—'}</td>
                        <td className="p-2 text-gray-700 dark:text-gray-300">{row.subject || '—'}</td>
                        <td className="p-2 text-gray-900 dark:text-gray-100">{row.teacherName || row.teacherEmail || '—'}</td>
                        <td className="p-2 text-gray-700 dark:text-gray-300">{row.teacherEmail || '—'}</td>
                        <td className="p-2 text-gray-700 dark:text-gray-300">{row.slotIds.length ? `${row.slotIds.length} hrs` : (row.timeDisplay || '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <motion.button
              type="button"
              onClick={handleApproveAndSend}
              disabled={applyLoading || validating || validationErrors.length > 0}
              title={validating ? 'Analyzing data…' : validationErrors.length > 0 ? 'Fix validation errors before sending' : undefined}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed transition-colors"
            >
              {applyLoading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              Approve &amp; Send to teachers
            </motion.button>
          </>
        )}

        {applyResult && (
          <div className={`p-4 rounded-xl border ${applyResult.applied > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
            {applyResult.applied > 0 && (
              <p className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-medium">
                <CheckCircle className="w-5 h-5" />
                Applied time table for {applyResult.applied} day(s). Entries are now on each teacher&apos;s calendar.
              </p>
            )}
            {applyResult.errors && applyResult.errors.length > 0 ? (
              <div className="mt-3">
                <p className="font-semibold text-red-800 dark:text-red-200 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {applyResult.errors.length} Issue{applyResult.errors.length !== 1 ? 's' : ''} Found:
                </p>
                <div className="max-h-60 overflow-y-auto bg-white/50 dark:bg-black/20 rounded-lg p-3 border border-red-100 dark:border-red-800/50">
                  <ul className="space-y-1.5 text-sm text-red-700 dark:text-red-300 list-disc pl-4">
                    {applyResult.errors.map((err, i) => (
                      <li key={i} className="break-words leading-relaxed">
                        {err.message || 'Unknown error occurred'}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (applyResult.applied === 0 && (
              <div className="mt-3 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg border border-red-200 dark:border-red-800">
                <p className="flex items-center gap-2 text-sm text-red-800 dark:text-red-200 font-bold">
                  <AlertCircle className="w-5 h-5" />
                  Submission Failed
                </p>

              </div>
            ))}
          </div>
        )}

        {entries.length === 0 && !uploadError && !applyResult && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500 dark:text-gray-400">
            <FileSpreadsheet className="w-12 h-12 mb-3 opacity-60" />
            <p className="text-sm">Download the template (DATE, DAY, BATCH, SUBJECT, FACULTY, EMAIL, TIME). Use each teacher&apos;s login email so they get their timetable on their calendar.</p>
            <p className="text-xs mt-1">Approve &amp; Send adds entries to each teacher&apos;s calendar by email.</p>
          </div>
        )}
      </div>
    </div>
  );
}
