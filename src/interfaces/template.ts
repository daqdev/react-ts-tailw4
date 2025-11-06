export interface TemplateField {
  key: string;
  type: string;
  path: string;
}

export interface Template {
  mandatoryFields: TemplateField[];
}
