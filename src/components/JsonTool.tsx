import React, { useState, useEffect } from 'react';

const JsonTool: React.FC = () => {
  const [inputJson, setInputJson] = useState('');
  const [formattedJson, setFormattedJson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isTemplateDragging, setIsTemplateDragging] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'valid' | 'invalid' | 'none'>('none');

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
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          setInputJson(text);
        };
        reader.readAsText(file);
      } else {
        setError('Invalid file type. Please drop a .txt or .json file.');
      }
    }
  };

          const handleTemplateDrop = (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();
            setIsTemplateDragging(false);      const file = event.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        console.log(1231);
        const text = e.target?.result as string;
        if (validateTemplate(text)) {
          setValidationStatus('valid');
          console.log('Template validation: Valid');
        } else {
          setValidationStatus('invalid');
          console.log('Template validation: Invalid');
        }
      };
      reader.readAsText(file);
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



  useEffect(() => {
    const handler = setTimeout(() => {
      if (inputJson.trim() === '') {
        setFormattedJson('');
        setError(null);
        return;
      }

      try {
        const parsed = JSON.parse(inputJson);
        setFormattedJson(JSON.stringify(parsed, null, 2));
        setError(null);
      } catch {
        setError('Invalid JSON format. Formatting as much as possible.');
        // Attempt to format what we can
        const partiallyFormatted = inputJson
          .replace(/\n/g, '\n')
          .replace(/'/g, "'")
          .replace(/"/g, '"')
          .replace(/&/g, '&')
          .replace(/\r/g, '\r')
          .replace(/\t/g, '\t')
          .replace(/\b/g, '\b')
          .replace(/\f/g, '\f');
        setFormattedJson(partiallyFormatted);
      }
    }, 500); // 500ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [inputJson]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputJson(event.target.value);
  };

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
          className="json-output"
          value={formattedJson}
          readOnly
          placeholder="Formatted JSON will appear here..."
        />
        <button onClick={handleCopy} className="copy-button">
          Copy Formatted JSON
        </button>
        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
};

export default JsonTool;
