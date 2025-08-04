import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import GenerateReportModal from '../../components/GenerateReportModal'

// Mock fetch
global.fetch = jest.fn()

// Mock the modal backdrop click handler
const mockOnClose = jest.fn()

const defaultProps = {
  isOpen: true,
  onClose: mockOnClose,
  clientId: 'test-client-id',
  clientName: 'Test Client',
  clientEmail: 'test@example.com',
}

describe('GenerateReportModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockClear()
  })

  test('renders modal with client information when open', () => {
    render(<GenerateReportModal {...defaultProps} />)

    expect(screen.getByText('Generate Report')).toBeInTheDocument()
    expect(screen.getByText('Test Client')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  test('does not render when closed', () => {
    render(<GenerateReportModal {...defaultProps} isOpen={false} />)

    expect(screen.queryByText('Generate Report')).not.toBeInTheDocument()
  })

  test('displays date range options', () => {
    render(<GenerateReportModal {...defaultProps} />)

    expect(screen.getByText('Monthly')).toBeInTheDocument()
    expect(screen.getByText('Quarterly')).toBeInTheDocument()
    expect(screen.getByText('Custom')).toBeInTheDocument()
  })

  test('shows month dropdown when monthly is selected', () => {
    render(<GenerateReportModal {...defaultProps} />)

    // Monthly should be selected by default
    const monthlyButton = screen.getByText('Monthly')
    expect(monthlyButton).toHaveClass('bg-blue-600')

    // Month dropdown should be visible
    expect(screen.getByText(/Styczeń|Luty|Marzec/)).toBeInTheDocument()
  })

  test('allows switching between date range types', () => {
    render(<GenerateReportModal {...defaultProps} />)

    // Click quarterly
    const quarterlyButton = screen.getByText('Quarterly')
    fireEvent.click(quarterlyButton)

    expect(quarterlyButton).toHaveClass('bg-blue-600')
    expect(screen.getByText('Monthly')).not.toHaveClass('bg-blue-600')

    // Click custom
    const customButton = screen.getByText('Custom')
    fireEvent.click(customButton)

    expect(customButton).toHaveClass('bg-blue-600')
    expect(screen.getByText('Quarterly')).not.toHaveClass('bg-blue-600')
  })

  test('shows custom date inputs when custom is selected', () => {
    render(<GenerateReportModal {...defaultProps} />)

    // Click custom
    const customButton = screen.getByText('Custom')
    fireEvent.click(customButton)

    // Should show date inputs
    expect(screen.getByLabelText(/Start Date/)).toBeInTheDocument()
    expect(screen.getByLabelText(/End Date/)).toBeInTheDocument()
  })

  test('generates report successfully', async () => {
    const mockPdfUrl = 'https://example.com/report.pdf'
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pdfUrl: mockPdfUrl }),
    })

    render(<GenerateReportModal {...defaultProps} />)

    // Click generate button
    const generateButton = screen.getByText('Generate Report')
    fireEvent.click(generateButton)

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Generating Report...')).toBeInTheDocument()
    })

    // Should call the API
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('test-client-id'),
      })
    })

    // Should show success state
    await waitFor(() => {
      expect(screen.getByText('Report Generated Successfully!')).toBeInTheDocument()
    })
  })

  test('handles report generation error', async () => {
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'))

    render(<GenerateReportModal {...defaultProps} />)

    // Click generate button
    const generateButton = screen.getByText('Generate Report')
    fireEvent.click(generateButton)

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to generate report/)).toBeInTheDocument()
    })
  })

  test('sends report via email successfully', async () => {
    const mockPdfUrl = 'https://example.com/report.pdf'
    ;(fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pdfUrl: mockPdfUrl }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

    render(<GenerateReportModal {...defaultProps} />)

    // Generate report first
    const generateButton = screen.getByText('Generate Report')
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(screen.getByText('Report Generated Successfully!')).toBeInTheDocument()
    })

    // Click send button
    const sendButton = screen.getByText('Send Report')
    fireEvent.click(sendButton)

    // Should show sending state
    await waitFor(() => {
      expect(screen.getByText('Sending Report...')).toBeInTheDocument()
    })

    // Should call the send API
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/send-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('test@example.com'),
      })
    })

    // Should show success state
    await waitFor(() => {
      expect(screen.getByText('Report Sent Successfully!')).toBeInTheDocument()
    })
  })

  test('handles email sending error', async () => {
    const mockPdfUrl = 'https://example.com/report.pdf'
    ;(fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pdfUrl: mockPdfUrl }),
      })
      .mockRejectedValueOnce(new Error('Email Error'))

    render(<GenerateReportModal {...defaultProps} />)

    // Generate report first
    const generateButton = screen.getByText('Generate Report')
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(screen.getByText('Report Generated Successfully!')).toBeInTheDocument()
    })

    // Click send button
    const sendButton = screen.getByText('Send Report')
    fireEvent.click(sendButton)

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to send report/)).toBeInTheDocument()
    })
  })

  test('allows downloading the generated report', async () => {
    const mockPdfUrl = 'https://example.com/report.pdf'
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pdfUrl: mockPdfUrl }),
    })

    render(<GenerateReportModal {...defaultProps} />)

    // Generate report
    const generateButton = screen.getByText('Generate Report')
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(screen.getByText('Report Generated Successfully!')).toBeInTheDocument()
    })

    // Download button should be available
    const downloadButton = screen.getByText('Download PDF')
    expect(downloadButton).toBeInTheDocument()

    // Click download
    fireEvent.click(downloadButton)

    // Should open the PDF URL
    expect(window.open).toHaveBeenCalledWith(mockPdfUrl, '_blank')
  })

  test('closes modal when close button is clicked', () => {
    render(<GenerateReportModal {...defaultProps} />)

    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  test('resets modal state when closed and reopened', async () => {
    const { rerender } = render(<GenerateReportModal {...defaultProps} />)

    // Generate a report
    const mockPdfUrl = 'https://example.com/report.pdf'
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pdfUrl: mockPdfUrl }),
    })

    const generateButton = screen.getByText('Generate Report')
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(screen.getByText('Report Generated Successfully!')).toBeInTheDocument()
    })

    // Close modal
    rerender(<GenerateReportModal {...defaultProps} isOpen={false} />)

    // Reopen modal
    rerender(<GenerateReportModal {...defaultProps} isOpen={true} />)

    // Should be back to initial state
    expect(screen.getByText('Generate Report')).toBeInTheDocument()
    expect(screen.queryByText('Report Generated Successfully!')).not.toBeInTheDocument()
  })

  test('shows preview toggle when report is generated', async () => {
    const mockPdfUrl = 'https://example.com/report.pdf'
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pdfUrl: mockPdfUrl }),
    })

    render(<GenerateReportModal {...defaultProps} />)

    // Generate report
    const generateButton = screen.getByText('Generate Report')
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(screen.getByText('Report Generated Successfully!')).toBeInTheDocument()
    })

    // Preview toggle should be available
    expect(screen.getByText('Show Preview')).toBeInTheDocument()
  })

  test('handles month selection from dropdown', () => {
    render(<GenerateReportModal {...defaultProps} />)

    // Click month dropdown
    const monthDropdown = screen.getByText(/Styczeń|Luty|Marzec/)
    fireEvent.click(monthDropdown)

    // Should show month options
    expect(screen.getByText(/Luty/)).toBeInTheDocument()
    expect(screen.getByText(/Marzec/)).toBeInTheDocument()
  })

  test('validates custom date range', () => {
    render(<GenerateReportModal {...defaultProps} />)

    // Switch to custom
    const customButton = screen.getByText('Custom')
    fireEvent.click(customButton)

    // Try to generate with invalid dates
    const generateButton = screen.getByText('Generate Report')
    fireEvent.click(generateButton)

    // Should show validation error
    expect(screen.getByText(/Please select valid dates/)).toBeInTheDocument()
  })
}) 