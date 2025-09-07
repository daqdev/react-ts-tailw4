import React, { useState, useEffect } from 'react';

const JsonTool: React.FC = () => {
  const [inputJson, setInputJson] = useState('');
  const [formattedJson, setFormattedJson] = useState('');
  const [error, setError] = useState<string | null>(null);

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
      } catch (e) {
        setError('Invalid JSON format. Formatting as much as possible.');
        // Attempt to format what we can
        const partiallyFormatted = inputJson
          .replace(/\\n/g, '\n')
          .replace(/\\'/g, "'")
          .replace(/\\\"/g, '"')
          .replace(/\\&/g, '&')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\b/g, '\b')
          .replace(/\\f/g, '\f');
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
      <textarea
        className="json-input"
        value={inputJson}
        onChange={handleInputChange}
        placeholder="Paste your JSON here..."
      />
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
