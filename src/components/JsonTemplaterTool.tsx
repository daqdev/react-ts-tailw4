import React, { useState, useEffect } from 'react';
import JsonTreeNode from './JsonTreeNode';
import type { TreeNode } from '../interfaces/jsonTemplater';

const JsonTemplaterTool: React.FC = () => {
  const [inputJson, setInputJson] = useState('');
  const [templateJson, setTemplateJson] = useState('');
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [mandatoryFields, setMandatoryFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    const buildTree = (data: any, path: string): TreeNode => {
      const type = Array.isArray(data) ? 'array' : typeof data;
      const children: TreeNode[] = [];

      if (type === 'object' && data !== null) {
        for (const key in data) {
          children.push(buildTree(data[key], `${path}.${key}`));
        }
      } else if (type === 'array' && data.length > 0 && typeof data[0] === 'object') {
        children.push(buildTree(data[0], `${path}[]`));
      }

      return {
        key: path.split('.').pop()!,
        type,
        path,
        children: children.length > 0 ? children : undefined,
      };
    };

    if (inputJson.trim() === '') {
      setTreeData(null);
      return;
    }

    try {
      const parsed = JSON.parse(inputJson);
      const tree = buildTree(parsed, 'root');
      setTreeData(tree);
    } catch {
      setTreeData(null);
    }
  }, [inputJson]);

  useEffect(() => {
    const generateTemplate = (node: TreeNode, mandatoryPaths: Set<string>): { mandatoryFields: { key: string; type: string; path: string }[] } => {
      const mandatoryFields: { key: string; type: string; path: string }[] = [];

      const traverse = (currentNode: TreeNode) => {
        if (mandatoryPaths.has(currentNode.path)) {
          mandatoryFields.push({
            key: currentNode.key,
            type: currentNode.type,
            path: currentNode.path,
          });
        }

        if (currentNode.children) {
          currentNode.children.forEach(traverse);
        }
      };

      traverse(node);

      return { mandatoryFields };
    };

    if (treeData) {
      const template = generateTemplate(treeData, mandatoryFields);
      setTemplateJson(JSON.stringify(template, null, 2));
    }
  }, [mandatoryFields, treeData]);

  const handleMandatoryChange = (path: string, checked: boolean) => {
    setMandatoryFields((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(path);
      } else {
        newSet.delete(path);
      }
      return newSet;
    });
  };

  return (
    <div className="json-templater-tool">
      <textarea
        className="json-input"
        value={inputJson}
        onChange={(e) => setInputJson(e.target.value)}
        placeholder="Paste your JSON here..."
      />
      <div className="json-output-container">
        {treeData && (
          <JsonTreeNode
            node={treeData}
            mandatoryFields={mandatoryFields}
            onMandatoryChange={handleMandatoryChange}
          />
        )}
      </div>
      <div className="json-output-container">
        <textarea
          className="json-output"
          value={templateJson}
          readOnly
          placeholder="Generated JSON template will appear here..."
        />
      </div>
    </div>
  );
};

export default JsonTemplaterTool;
