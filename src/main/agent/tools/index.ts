import Anthropic from '@anthropic-ai/sdk'
import * as fs from './filesystem'
import * as cal from './calendar'
import * as email from './email'
import * as stripe from './stripe'
import * as mem from './memory'
import * as computer from './computer'
export type { ImageResult } from './computer'

export type ToolName =
  | 'list_directory'
  | 'read_file'
  | 'write_file'
  | 'append_to_file'
  | 'create_directory'
  | 'move_file'
  | 'delete_file'
  | 'search_files'
  | 'list_calendar_events'
  | 'create_calendar_event'
  | 'update_calendar_event'
  | 'delete_calendar_event'
  | 'list_recent_emails'
  | 'search_emails'
  | 'get_email'
  | 'send_email'
  | 'draft_email'
  | 'get_unread_count'
  | 'stripe_get_balance'
  | 'stripe_revenue_summary'
  | 'stripe_list_customers'
  | 'stripe_get_customer'
  | 'stripe_list_invoices'
  | 'stripe_create_invoice'
  | 'stripe_send_invoice'
  | 'stripe_issue_refund'
  | 'stripe_list_subscriptions'
  | 'stripe_cancel_subscription'
  | 'save_memory'
  | 'search_memory'
  | 'list_memories'
  | 'delete_memory'
  | 'screenshot'
  | 'mouse_move'
  | 'mouse_click'
  | 'mouse_double_click'
  | 'mouse_scroll'
  | 'keyboard_type'
  | 'keyboard_press'
  | 'open_app'
  | 'get_screen_size'
  | 'run_command'

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  // ── File System ──────────────────────────────────────────────────────────────
  {
    name: 'list_directory',
    description: 'List files and folders in a directory.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Absolute path to directory' } },
      required: ['path']
    }
  },
  {
    name: 'read_file',
    description: 'Read the contents of a text file.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Absolute path to file' } },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file (overwrites existing, auto-backups first).',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to file' },
        content: { type: 'string', description: 'Content to write' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'append_to_file',
    description: 'Append content to the end of a file.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to file' },
        content: { type: 'string', description: 'Content to append' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'create_directory',
    description: 'Create a new directory (including intermediate dirs).',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Absolute path to create' } },
      required: ['path']
    }
  },
  {
    name: 'move_file',
    description: 'Move or rename a file or directory.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Current path' },
        to: { type: 'string', description: 'New path' }
      },
      required: ['from', 'to']
    }
  },
  {
    name: 'delete_file',
    description: 'Move a file to Jarvis trash (recoverable for 30 days). Requires confirmation for irreversible deletes.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Absolute path to file or directory' } },
      required: ['path']
    }
  },
  {
    name: 'search_files',
    description: 'Search for files by name or content within a directory.',
    input_schema: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Root directory to search' },
        query: { type: 'string', description: 'Search term' }
      },
      required: ['directory', 'query']
    }
  },
  // ── Calendar ─────────────────────────────────────────────────────────────────
  {
    name: 'list_calendar_events',
    description: 'List upcoming Google Calendar events.',
    input_schema: {
      type: 'object',
      properties: {
        timeMin: { type: 'string', description: 'ISO8601 start time (default: now)' },
        timeMax: { type: 'string', description: 'ISO8601 end time (default: 7 days from now)' },
        maxResults: { type: 'number', description: 'Max events to return (default 10)' }
      },
      required: []
    }
  },
  {
    name: 'create_calendar_event',
    description: 'Create a new Google Calendar event.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Event title' },
        startDateTime: { type: 'string', description: 'ISO8601 start datetime' },
        endDateTime: { type: 'string', description: 'ISO8601 end datetime' },
        description: { type: 'string', description: 'Event description' },
        attendeeEmails: { type: 'array', items: { type: 'string' }, description: 'List of attendee emails' }
      },
      required: ['summary', 'startDateTime', 'endDateTime']
    }
  },
  {
    name: 'update_calendar_event',
    description: 'Update an existing calendar event.',
    input_schema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Calendar event ID' },
        summary: { type: 'string' },
        startDateTime: { type: 'string' },
        endDateTime: { type: 'string' },
        description: { type: 'string' }
      },
      required: ['eventId']
    }
  },
  {
    name: 'delete_calendar_event',
    description: 'Delete a calendar event.',
    input_schema: {
      type: 'object',
      properties: { eventId: { type: 'string', description: 'Calendar event ID' } },
      required: ['eventId']
    }
  },
  // ── Email ─────────────────────────────────────────────────────────────────────
  {
    name: 'list_recent_emails',
    description: 'List recent emails from inbox.',
    input_schema: {
      type: 'object',
      properties: { maxResults: { type: 'number', description: 'Max emails (default 10)' } },
      required: []
    }
  },
  {
    name: 'search_emails',
    description: 'Search emails using Gmail query syntax.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query (e.g. "from:sarah@example.com")' },
        maxResults: { type: 'number' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_email',
    description: 'Get the full content of an email by its message ID.',
    input_schema: {
      type: 'object',
      properties: { messageId: { type: 'string', description: 'Gmail message ID' } },
      required: ['messageId']
    }
  },
  {
    name: 'send_email',
    description: 'Send an email.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (plain text)' },
        replyToMessageId: { type: 'string', description: 'Message ID to reply to (optional)' },
        threadId: { type: 'string', description: 'Thread ID to reply in (optional)' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'draft_email',
    description: 'Create an email draft (does not send).',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'get_unread_count',
    description: 'Get number of unread emails in inbox.',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  // ── Stripe ────────────────────────────────────────────────────────────────────
  {
    name: 'stripe_get_balance',
    description: 'Get current Stripe account balance.',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'stripe_revenue_summary',
    description: 'Get revenue summary for a time period.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month'], description: 'Time period' }
      },
      required: ['period']
    }
  },
  {
    name: 'stripe_list_customers',
    description: 'List Stripe customers, optionally filtered by name/email search.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        search: { type: 'string', description: 'Search by name or email' }
      },
      required: []
    }
  },
  {
    name: 'stripe_get_customer',
    description: 'Get full details for a Stripe customer.',
    input_schema: {
      type: 'object',
      properties: { customerId: { type: 'string' } },
      required: ['customerId']
    }
  },
  {
    name: 'stripe_list_invoices',
    description: 'List invoices, optionally filtered by customer or status.',
    input_schema: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'open', 'paid', 'uncollectible', 'void'] },
        limit: { type: 'number' }
      },
      required: []
    }
  },
  {
    name: 'stripe_create_invoice',
    description: 'Create a new invoice for a customer.',
    input_schema: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              amount: { type: 'number', description: 'Amount in dollars (e.g. 500 for $500)' },
              currency: { type: 'string', description: 'ISO currency code (default: usd)' }
            },
            required: ['description', 'amount']
          }
        },
        daysUntilDue: { type: 'number', description: 'Payment due in N days (default 14)' }
      },
      required: ['customerId', 'items']
    }
  },
  {
    name: 'stripe_send_invoice',
    description: 'Send a draft invoice to the customer.',
    input_schema: {
      type: 'object',
      properties: { invoiceId: { type: 'string' } },
      required: ['invoiceId']
    }
  },
  {
    name: 'stripe_issue_refund',
    description: 'Issue a full or partial refund for a charge.',
    input_schema: {
      type: 'object',
      properties: {
        chargeId: { type: 'string' },
        amountCents: { type: 'number', description: 'Amount in cents for partial refund (omit for full refund)' }
      },
      required: ['chargeId']
    }
  },
  {
    name: 'stripe_list_subscriptions',
    description: 'List subscriptions, optionally filtered by customer or status.',
    input_schema: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        status: { type: 'string' }
      },
      required: []
    }
  },
  {
    name: 'stripe_cancel_subscription',
    description: 'Cancel a subscription (at period end by default).',
    input_schema: {
      type: 'object',
      properties: {
        subscriptionId: { type: 'string' },
        atPeriodEnd: { type: 'boolean', description: 'If true, cancel at end of current period (default true)' }
      },
      required: ['subscriptionId']
    }
  },
  // ── Memory ────────────────────────────────────────────────────────────────────
  {
    name: 'save_memory',
    description: 'Save a fact, preference, or note to long-term memory.',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Short key/name for this memory' },
        value: { type: 'string', description: 'The information to remember' },
        type: {
          type: 'string',
          enum: ['fact', 'preference', 'client', 'project', 'note'],
          description: 'Category of memory'
        },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags for retrieval' }
      },
      required: ['key', 'value']
    }
  },
  {
    name: 'search_memory',
    description: 'Search long-term memory for relevant facts.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search term' } },
      required: ['query']
    }
  },
  {
    name: 'list_memories',
    description: 'List all memories, optionally filtered by type.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['fact', 'preference', 'client', 'project', 'note'] }
      },
      required: []
    }
  },
  {
    name: 'delete_memory',
    description: 'Delete a memory entry by key.',
    input_schema: {
      type: 'object',
      properties: { key: { type: 'string' } },
      required: ['key']
    }
  },
  // ── Computer Use ──────────────────────────────────────────────────────────────
  {
    name: 'screenshot',
    description: 'Take a screenshot of the entire screen. Returns the image so you can see what is on screen. Always take a screenshot before clicking anything so you can identify the correct coordinates.',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_screen_size',
    description: 'Get the screen dimensions in pixels. Use this to understand coordinate space before moving the mouse.',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'mouse_move',
    description: 'Move the mouse cursor to a specific position on screen.',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate in pixels' },
        y: { type: 'number', description: 'Y coordinate in pixels' }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'mouse_click',
    description: 'Click the mouse at a specific screen position.',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate in pixels' },
        y: { type: 'number', description: 'Y coordinate in pixels' },
        button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button (default: left)' }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'mouse_double_click',
    description: 'Double-click at a specific screen position.',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'mouse_scroll',
    description: 'Scroll the mouse wheel at a position.',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        direction: { type: 'string', enum: ['up', 'down'] },
        clicks: { type: 'number', description: 'Number of scroll clicks (default 3)' }
      },
      required: ['x', 'y', 'direction']
    }
  },
  {
    name: 'keyboard_type',
    description: 'Type text as keyboard input into the currently focused window.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to type' }
      },
      required: ['text']
    }
  },
  {
    name: 'keyboard_press',
    description: 'Press a keyboard shortcut or special key. Uses Windows SendKeys syntax: ^ = Ctrl, % = Alt, + = Shift. Special keys in braces: {ENTER} {TAB} {ESC} {F5} {UP} {DOWN} {LEFT} {RIGHT} {DELETE} {HOME} {END}. Examples: "^c" (Ctrl+C), "^v" (Ctrl+V), "%{F4}" (Alt+F4), "^+{ESC}" (Task Manager), "{WIN}" (Win key).',
    input_schema: {
      type: 'object',
      properties: {
        combo: { type: 'string', description: 'Key combination in SendKeys syntax' }
      },
      required: ['combo']
    }
  },
  {
    name: 'open_app',
    description: 'Open an application by name or executable path.',
    input_schema: {
      type: 'object',
      properties: {
        nameOrPath: { type: 'string', description: 'App name (e.g. "notepad", "chrome", "spotify") or full path' }
      },
      required: ['nameOrPath']
    }
  },
  {
    name: 'run_command',
    description: 'Run a PowerShell or shell command and return the output. Use for system tasks, file operations, or anything requiring the shell.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to run' }
      },
      required: ['command']
    }
  }
]

export async function executeTool(
  name: ToolName,
  input: Record<string, unknown>
): Promise<string | ImageResult> {
  try {
    switch (name) {
      // filesystem
      case 'list_directory': return fs.listDirectory(input.path as string)
      case 'read_file': return fs.readFile(input.path as string)
      case 'write_file': return fs.writeFile(input.path as string, input.content as string)
      case 'append_to_file': return fs.appendToFile(input.path as string, input.content as string)
      case 'create_directory': return fs.createDirectory(input.path as string)
      case 'move_file': return fs.moveFile(input.from as string, input.to as string)
      case 'delete_file': return fs.deleteFile(input.path as string)
      case 'search_files': return fs.searchFiles(input.directory as string, input.query as string)
      // calendar
      case 'list_calendar_events': return await cal.listCalendarEvents(
        input.timeMin as string | undefined,
        input.timeMax as string | undefined,
        input.maxResults as number | undefined
      )
      case 'create_calendar_event': return await cal.createCalendarEvent(
        input.summary as string,
        input.startDateTime as string,
        input.endDateTime as string,
        input.description as string | undefined,
        input.attendeeEmails as string[] | undefined
      )
      case 'update_calendar_event': return await cal.updateCalendarEvent(
        input.eventId as string,
        {
          summary: input.summary as string | undefined,
          startDateTime: input.startDateTime as string | undefined,
          endDateTime: input.endDateTime as string | undefined,
          description: input.description as string | undefined
        }
      )
      case 'delete_calendar_event': return await cal.deleteCalendarEvent(input.eventId as string)
      // email
      case 'list_recent_emails': return await email.listRecentEmails(input.maxResults as number | undefined)
      case 'search_emails': return await email.searchEmails(input.query as string, input.maxResults as number | undefined)
      case 'get_email': return await email.getEmail(input.messageId as string)
      case 'send_email': return await email.sendEmail(
        input.to as string,
        input.subject as string,
        input.body as string,
        input.replyToMessageId as string | undefined,
        input.threadId as string | undefined
      )
      case 'draft_email': return await email.draftEmail(
        input.to as string,
        input.subject as string,
        input.body as string
      )
      case 'get_unread_count': return await email.getUnreadCount()
      // stripe
      case 'stripe_get_balance': return await stripe.getBalance()
      case 'stripe_revenue_summary': return await stripe.getRevenueSummary(input.period as 'today' | 'week' | 'month')
      case 'stripe_list_customers': return await stripe.listCustomers(input.limit as number | undefined, input.search as string | undefined)
      case 'stripe_get_customer': return await stripe.getCustomer(input.customerId as string)
      case 'stripe_list_invoices': return await stripe.listInvoices(
        input.customerId as string | undefined,
        input.status as string | undefined,
        input.limit as number | undefined
      )
      case 'stripe_create_invoice': return await stripe.createInvoice(
        input.customerId as string,
        input.items as Array<{ description: string; amount: number; currency?: string }>,
        input.daysUntilDue as number | undefined
      )
      case 'stripe_send_invoice': return await stripe.sendInvoice(input.invoiceId as string)
      case 'stripe_issue_refund': return await stripe.issueRefund(
        input.chargeId as string,
        input.amountCents as number | undefined
      )
      case 'stripe_list_subscriptions': return await stripe.listSubscriptions(
        input.customerId as string | undefined,
        input.status as string | undefined
      )
      case 'stripe_cancel_subscription': return await stripe.cancelSubscription(
        input.subscriptionId as string,
        input.atPeriodEnd as boolean | undefined
      )
      // memory
      case 'save_memory': return mem.toolSaveMemory(
        input.key as string,
        input.value as string,
        input.type as any,
        input.tags as string[] | undefined
      )
      case 'search_memory': return mem.toolSearchMemory(input.query as string)
      case 'list_memories': return mem.toolListMemories(input.type as string | undefined)
      case 'delete_memory': return mem.toolDeleteMemory(input.key as string)
      // computer use
      case 'screenshot': return await computer.takeScreenshot()
      case 'get_screen_size': return computer.getScreenSize()
      case 'mouse_move': return computer.moveMouse(input.x as number, input.y as number)
      case 'mouse_click': return computer.clickMouse(input.x as number, input.y as number, input.button as any)
      case 'mouse_double_click': return computer.doubleClick(input.x as number, input.y as number)
      case 'mouse_scroll': return computer.scrollAt(input.x as number, input.y as number, input.direction as any, input.clicks as number | undefined)
      case 'keyboard_type': return computer.typeText(input.text as string)
      case 'keyboard_press': return computer.pressKey(input.combo as string)
      case 'open_app': return computer.openApp(input.nameOrPath as string)
      case 'run_command': return computer.runShellCommand(input.command as string)
      default: throw new Error(`Unknown tool: ${name}`)
    }
  } catch (err: any) {
    return `Error: ${err.message}`
  }
}

export function getToolLabel(name: string, input: Record<string, unknown>): string {
  const labels: Record<string, (i: Record<string, unknown>) => string> = {
    list_directory: (i) => `List ${i.path}`,
    read_file: (i) => `Read ${i.path}`,
    write_file: (i) => `Write ${i.path}`,
    append_to_file: (i) => `Append to ${i.path}`,
    create_directory: (i) => `Create dir ${i.path}`,
    move_file: (i) => `Move file`,
    delete_file: (i) => `Delete ${i.path}`,
    search_files: (i) => `Search files: "${i.query}"`,
    list_calendar_events: () => `Fetch calendar`,
    create_calendar_event: (i) => `Create event: ${i.summary}`,
    update_calendar_event: () => `Update event`,
    delete_calendar_event: () => `Delete event`,
    list_recent_emails: () => `List emails`,
    search_emails: (i) => `Search email: "${i.query}"`,
    get_email: (i) => `Read email ${i.messageId}`,
    send_email: (i) => `Send email to ${i.to}`,
    draft_email: (i) => `Draft email to ${i.to}`,
    get_unread_count: () => `Check unread`,
    stripe_get_balance: () => `Stripe balance`,
    stripe_revenue_summary: (i) => `Revenue (${i.period})`,
    stripe_list_customers: () => `List customers`,
    stripe_get_customer: (i) => `Get customer ${i.customerId}`,
    stripe_list_invoices: () => `List invoices`,
    stripe_create_invoice: (i) => `Create invoice for ${i.customerId}`,
    stripe_send_invoice: (i) => `Send invoice ${i.invoiceId}`,
    stripe_issue_refund: (i) => `Refund charge ${i.chargeId}`,
    stripe_list_subscriptions: () => `List subscriptions`,
    stripe_cancel_subscription: (i) => `Cancel subscription ${i.subscriptionId}`,
    save_memory: (i) => `Remember: ${i.key}`,
    search_memory: (i) => `Search memory: ${i.query}`,
    list_memories: () => `List memories`,
    delete_memory: (i) => `Forget: ${i.key}`,
    screenshot: () => `Take screenshot`,
    get_screen_size: () => `Get screen size`,
    mouse_move: (i) => `Move mouse to (${i.x}, ${i.y})`,
    mouse_click: (i) => `Click at (${i.x}, ${i.y})`,
    mouse_double_click: (i) => `Double-click at (${i.x}, ${i.y})`,
    mouse_scroll: (i) => `Scroll ${i.direction} at (${i.x}, ${i.y})`,
    keyboard_type: (i) => `Type: "${String(i.text).slice(0, 30)}"`,
    keyboard_press: (i) => `Press: ${i.combo}`,
    open_app: (i) => `Open ${i.nameOrPath}`,
    run_command: (i) => `Run: ${String(i.command).slice(0, 40)}`
  }
  return labels[name]?.(input) || name
}
