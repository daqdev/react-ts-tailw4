import React, { useState, useEffect } from 'react';
import type { Template } from '../interfaces/template';
import { formatJson } from '../lib/json/format';
import { cleanPasteArtifacts, findPasteArtifacts } from '../lib/json/pasteArtifacts';
import { decodeTextFile } from '../lib/textFile';

/** Reads a dropped file, noting when it had to fall back from UTF-8. */
async function readDroppedFile(file: File): Promise<{ text: string; note: string | null }> {
  const { text, encoding } = decodeTextFile(await file.arrayBuffer());
  const note = encoding === 'windows-1252'
    ? `"${file.name}" is not UTF-8, so it was read as Windows-1252 (ANSI).`
    : null;
  return { text, note };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const JsonTool: React.FC = () => {
  const [inputJson, setInputJson] = useState('');
  const [formattedJson, setFormattedJson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isTemplateDragging, setIsTemplateDragging] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'valid' | 'invalid' | 'none'>('none');
  const [template, setTemplate] = useState<Template | null>(null);
  const [missingFields, setMissingFields] = useState<Set<string>>(new Set());
  const [keptNumbers, setKeptNumbers] = useState<string[]>([]);
  const [fileNote, setFileNote] = useState<string | null>(null);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, isTemplateDropZone: boolean = false) => {
    event.preventDefault();
    event.stopPropagation();
    if (isTemplateDropZone) {
      setIsTemplateDragging(true);
    } else {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>, isTemplateDropZone: boolean = false) => {
    event.preventDefault();
    event.stopPropagation();
    if (isTemplateDropZone) {
      setIsTemplateDragging(false);
    } else {
      setIsDragging(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const file = event.dataTransfer.files[0];

    if (file) {
      if (file.type === 'text/plain' || file.type === 'application/json') {
        readDroppedFile(file).then(({ text, note }) => {
          setInputJson(text);
          setFileNote(note);
        });
      } else {
        setError('Invalid file type. Please drop a .txt or .json file.');
      }
    }
  };

  const handleTemplateDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsTemplateDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      readDroppedFile(file).then(({ text, note }) => {
        setFileNote(note);
        if (validateTemplate(text)) {
          setValidationStatus('valid');
          setTemplate(JSON.parse(text));
        } else {
          setValidationStatus('invalid');
          setTemplate(null);
        }
      });
    }
  };

  const validateTemplate = (text: string): boolean => {
    try {
      const parsed = JSON.parse(text);

      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.mandatoryFields)) {
        return false;
      }

      if (parsed.mandatoryFields.length === 0) {
        return true; // Empty mandatoryFields array is valid
      }

      for (const field of parsed.mandatoryFields) {
        if (
          typeof field !== 'object' ||
          !Object.prototype.hasOwnProperty.call(field, 'key') ||
          !Object.prototype.hasOwnProperty.call(field, 'type') ||
          !Object.prototype.hasOwnProperty.call(field, 'path') ||
          typeof field.key !== 'string' ||
          typeof field.type !== 'string' ||
          typeof field.path !== 'string'
        ) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  };



  const validateJsonAgainstTemplate = (json: string, template: Template): Set<string> => {
    const missing = new Set<string>();
    if (!template || !template.mandatoryFields || template.mandatoryFields.length === 0) {
      return missing;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(json);
    } catch {
      return missing; // If JSON is invalid, all fields are effectively missing or cannot be validated
    }

    template.mandatoryFields.forEach(field => {
      const pathParts = field.path.split('.');
      let current: unknown = parsedJson;
      let found = true;

      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        if (part === 'root') {
          continue;
        }

        if (part.endsWith('[]')) { // Handle array notation
          const arrayKey = part.slice(0, -2);
          if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, arrayKey) || !Array.isArray((current as Record<string, unknown>)[arrayKey]) || ((current as Record<string, unknown>)[arrayKey] as unknown[]).length === 0) {
            found = false;
            break;
          }
          // For simplicity, we just check if the array exists and has elements.
          // More complex validation would involve checking each element.
          current = ((current as Record<string, unknown>)[arrayKey] as unknown[])[0]; // Check against the first element
        } else if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part)) {
          current = (current as Record<string, unknown>)[part];
        } else {
          found = false;
          break;
        }
      }

      if (!found) {
        missing.add(field.path);
      }
    });

    return missing;
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      if (inputJson.trim() === '') {
        setFormattedJson('');
        setError(null);
        setMissingFields(new Set());
        setKeptNumbers([]);
        return;
      }

      try {
        const result = formatJson(inputJson);
        setFormattedJson(result.text);
        setKeptNumbers(result.keptNumbers);
        setError(null);

        if (template) {
          setMissingFields(validateJsonAgainstTemplate(inputJson, template));
        } else {
          setMissingFields(new Set());
        }

      } catch (e) {
        // Show the input untouched: rewriting invalid JSON only adds confusion.
        const reason = e instanceof Error ? e.message : String(e);
        setError(`Invalid JSON: ${reason}. The input is shown unchanged.`);
        setFormattedJson(inputJson);
        setKeptNumbers([]);
        setMissingFields(new Set());
      }
    }, 500); // 500ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [inputJson, template]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputJson(event.target.value);
    setFileNote(null);
  };

  // Only worth pointing out when they are why the JSON doesn't parse.
  const artifacts = error ? findPasteArtifacts(inputJson) : null;
  const artifactParts = artifacts
    ? [
        artifacts.smartQuotes && plural(artifacts.smartQuotes, 'curly quote'),
        artifacts.specialSpaces && plural(artifacts.specialSpaces, 'non-breaking space'),
        artifacts.invisible && plural(artifacts.invisible, 'invisible character'),
      ].filter((part): part is string => Boolean(part))
    : [];
  const artifactSummary = artifactParts.length > 1
    ? `${artifactParts.slice(0, -1).join(', ')} and ${artifactParts[artifactParts.length - 1]}`
    : artifactParts[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
  };

  return (
    <div className="json-tool">
      <div className="flex-container">
        <div
          className={`drop-zone ${isDragging ? 'drop-zone-dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <textarea
            className="json-input"
            value={inputJson}
            onChange={handleInputChange}
            placeholder="Paste your JSON here or drop a file..."
          />
          <div className="drop-zone-placeholder">
            <p>Paste your JSON here or drop a file</p>
          </div>
        </div>
        <div
          className={`template-drop-zone ${validationStatus} ${isTemplateDragging ? 'drop-zone-dragging' : ''}`}
          onDragOver={(event) => handleDragOver(event, true)}
          onDragLeave={(event) => handleDragLeave(event, true)}
          onDrop={handleTemplateDrop}
        >
          <p>Drop Template File</p>
        </div>
      </div>
      <div className="json-output-container">
        <textarea
          className={`json-output ${missingFields.size > 0 ? 'validation-error' : ''}`}
          value={formattedJson}
          readOnly
          placeholder="Formatted JSON will appear here..."
        />
        <button onClick={handleCopy} className="copy-button">
          Copy Formatted JSON
        </button>
        {error && <div className="error-message">{error}</div>}
        {artifacts && artifacts.total > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-700">
            <span>
              The input has {artifactSummary}, which JSON doesn't accept. They usually come from
              copying out of Word, Outlook, Teams or a web page.
            </span>
            <button
              type="button"
              onClick={() => setInputJson(cleanPasteArtifacts(inputJson))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-700 shadow-sm hover:bg-slate-100"
            >
              Replace them
            </button>
          </div>
        )}
        {keptNumbers.length > 0 && (
          <div className="mt-2 text-sm text-slate-700">
            Kept as written, because JavaScript can't hold these numbers exactly: {keptNumbers.join(', ')}
          </div>
        )}
        {fileNote && <div className="mt-2 text-sm text-slate-700">{fileNote}</div>}
        {missingFields.size > 0 && (
          <div className="error-message">
            Missing mandatory fields: {Array.from(missingFields).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
};

export default JsonTool;
