import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import FormPage from './FormPage'

describe('FormPage', () => {
  it('reports validation errors instead of submitting', async () => {
    const user = userEvent.setup()
    render(<FormPage />)

    await user.click(screen.getByRole('button', { name: 'Create project' }))

    expect(await screen.findByText('Use at least 2 characters.')).toBeInTheDocument()
    expect(screen.getByText('You must accept the terms.')).toBeInTheDocument()
    expect(screen.getByTestId('form-output')).toHaveTextContent('Nothing submitted yet.')
  })

  it('marks invalid fields for assistive technology', async () => {
    const user = userEvent.setup()
    render(<FormPage />)

    await user.type(screen.getByLabelText('Owner email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Create project' }))

    await waitFor(() =>
      expect(screen.getByLabelText('Owner email')).toHaveAttribute('aria-invalid', 'true'),
    )
  })

  it('submits typed values once the form is valid', async () => {
    const user = userEvent.setup()
    render(<FormPage />)

    await user.type(screen.getByLabelText('Project name'), 'acme-web')
    await user.type(screen.getByLabelText('Owner email'), 'dev@example.com')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Create project' }))

    const output = await screen.findByTestId('form-output')
    await waitFor(() => expect(output).toHaveTextContent('"name": "acme-web"'))
    expect(output).toHaveTextContent('"email": "dev@example.com"')
    expect(output).toHaveTextContent('"environment": "development"')
  })
})
