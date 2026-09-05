import { createContext, useContext, useId } from 'react'
import { useFormContext, useFormState, type FieldPath, type FieldValues } from 'react-hook-form'

export const FormFieldContext = createContext<{ name: string } | undefined>(undefined)
export const FormItemContext = createContext<{ id: string } | undefined>(undefined)

/**
 * Wires one field's id, aria-* attributes and error state together so
 * <FormLabel>, <FormControl>, <FormDescription> and <FormMessage> stay in sync.
 */
export function useFormField() {
  const fieldContext = useContext(FormFieldContext)
  const itemContext = useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext?.name as FieldPath<FieldValues> })

  if (!fieldContext) throw new Error('useFormField must be used within a <FormField>')
  if (!itemContext) throw new Error('useFormField must be used within a <FormItem>')

  const fieldState = getFieldState(fieldContext.name as FieldPath<FieldValues>, formState)
  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

/** Stable per-item id generator, kept here so <FormItem> stays a thin component. */
export function useFormItemId() {
  return useId()
}
