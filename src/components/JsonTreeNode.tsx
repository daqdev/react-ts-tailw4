import React from 'react';
import type { TreeNode } from '../interfaces/jsonTemplater';

interface JsonTreeNodeProps {
  node: TreeNode;
  mandatoryFields: Set<string>;
  onMandatoryChange: (path: string, checked: boolean) => void;
}

const JsonTreeNode: React.FC<JsonTreeNodeProps> = ({ node, mandatoryFields, onMandatoryChange }) => {
  const { key, type, path, children } = node;
  const displayKey = path.endsWith('[]') ? '[]' : key;

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onMandatoryChange(path, event.target.checked);
  };

  return (
    <div style={{ marginLeft: '20px' }}>
      <div>
        <input
          type="checkbox"
          checked={mandatoryFields.has(path)}
          onChange={handleCheckboxChange}
        />
        <strong>{displayKey}:</strong> {type}
      </div>
      {children && children.map((child) => (
        <JsonTreeNode
          key={child.path}
          node={child}
          mandatoryFields={mandatoryFields}
          onMandatoryChange={onMandatoryChange}
        />
      ))}
    </div>
  );
};

export default JsonTreeNode;
