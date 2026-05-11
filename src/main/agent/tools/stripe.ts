import Stripe from 'stripe'
import { store } from '../../settings'

function getStripe(): Stripe {
  const apiKey = store.get('stripeApiKey') as string
  if (!apiKey) {
    throw new Error(
      'Stripe API key not configured. Go to Settings → Integrations and add your Stripe secret key.'
    )
  }
  return new Stripe(apiKey, { apiVersion: '2024-04-10' })
}

export async function getBalance(): Promise<string> {
  const stripe = getStripe()
  const balance = await stripe.balance.retrieve()
  const available = balance.available.map((b) => `${(b.amount / 100).toFixed(2)} ${b.currency.toUpperCase()}`).join(', ')
  const pending = balance.pending.map((b) => `${(b.amount / 100).toFixed(2)} ${b.currency.toUpperCase()}`).join(', ')
  return `Available: ${available}\nPending: ${pending}`
}

export async function getRevenueSummary(period: 'today' | 'week' | 'month' = 'month'): Promise<string> {
  const stripe = getStripe()
  const now = Math.floor(Date.now() / 1000)
  const periodMap = { today: 86400, week: 7 * 86400, month: 30 * 86400 }
  const since = now - periodMap[period]

  const charges = await stripe.charges.list({
    created: { gte: since },
    limit: 100
  })

  const successful = charges.data.filter((c) => c.status === 'succeeded' && !c.refunded)
  const total = successful.reduce((sum, c) => sum + c.amount, 0)
  const currency = successful[0]?.currency?.toUpperCase() || 'USD'
  const refunds = charges.data.filter((c) => c.refunded).length
  const failed = charges.data.filter((c) => c.status === 'failed').length

  return (
    `Revenue summary (${period}):\n` +
    `  Total: ${(total / 100).toFixed(2)} ${currency}\n` +
    `  Transactions: ${successful.length}\n` +
    `  Failed: ${failed}\n` +
    `  Refunded: ${refunds}`
  )
}

export async function listCustomers(limit = 10, search?: string): Promise<string> {
  const stripe = getStripe()
  let customers: Stripe.Customer[]
  if (search) {
    const result = await stripe.customers.search({ query: `name:"${search}" OR email:"${search}"`, limit })
    customers = result.data
  } else {
    const result = await stripe.customers.list({ limit })
    customers = result.data as Stripe.Customer[]
  }
  if (customers.length === 0) return 'No customers found.'
  return customers
    .map((c) => `[${c.id}] ${c.name || 'No name'} — ${c.email || 'no email'} — ${c.currency?.toUpperCase() || '?'}`)
    .join('\n')
}

export async function getCustomer(customerId: string): Promise<string> {
  const stripe = getStripe()
  const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer
  const subscriptions = await stripe.subscriptions.list({ customer: customerId, limit: 5 })
  const invoices = await stripe.invoices.list({ customer: customerId, limit: 5 })
  const outstandingInvoices = invoices.data.filter((i) => i.status === 'open')
  const mrr = subscriptions.data
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => {
      const item = s.items.data[0]
      const amount = item?.price?.unit_amount || 0
      const interval = item?.price?.recurring?.interval
      const multiplier = interval === 'year' ? 1 / 12 : 1
      return sum + amount * multiplier
    }, 0)

  return (
    `Customer: ${customer.name || 'Unknown'}\n` +
    `Email: ${customer.email}\n` +
    `ID: ${customerId}\n` +
    `Created: ${new Date((customer.created || 0) * 1000).toLocaleDateString()}\n` +
    `Active subscriptions: ${subscriptions.data.filter((s) => s.status === 'active').length}\n` +
    `MRR: $${(mrr / 100).toFixed(2)}\n` +
    `Outstanding invoices: ${outstandingInvoices.length}`
  )
}

export async function listInvoices(customerId?: string, status?: string, limit = 10): Promise<string> {
  const stripe = getStripe()
  const params: Stripe.InvoiceListParams = { limit }
  if (customerId) params.customer = customerId
  if (status) params.status = status as Stripe.InvoiceListParams.Status
  const invoices = await stripe.invoices.list(params)
  if (invoices.data.length === 0) return 'No invoices found.'
  return invoices.data
    .map(
      (i) =>
        `[${i.id}] ${i.customer_name || i.customer_email || i.customer} — ` +
        `$${((i.amount_due || 0) / 100).toFixed(2)} — ${i.status} — due ${i.due_date ? new Date(i.due_date * 1000).toLocaleDateString() : 'n/a'}`
    )
    .join('\n')
}

export async function createInvoice(
  customerId: string,
  items: Array<{ description: string; amount: number; currency?: string }>,
  daysUntilDue = 14
): Promise<string> {
  const stripe = getStripe()
  // create invoice items
  for (const item of items) {
    await stripe.invoiceItems.create({
      customer: customerId,
      amount: Math.round(item.amount * 100),
      currency: item.currency || 'usd',
      description: item.description
    })
  }
  const invoice = await stripe.invoices.create({
    customer: customerId,
    days_until_due: daysUntilDue,
    collection_method: 'send_invoice'
  })
  return `Invoice created (ID: ${invoice.id}) for $${((invoice.amount_due || 0) / 100).toFixed(2)}. Use send_invoice to send it.`
}

export async function sendInvoice(invoiceId: string): Promise<string> {
  const stripe = getStripe()
  const invoice = await stripe.invoices.sendInvoice(invoiceId)
  return `Invoice ${invoiceId} sent to ${invoice.customer_email}. Due: ${invoice.due_date ? new Date(invoice.due_date * 1000).toLocaleDateString() : 'n/a'}`
}

export async function issueRefund(chargeId: string, amountCents?: number): Promise<string> {
  const stripe = getStripe()
  const params: Stripe.RefundCreateParams = { charge: chargeId }
  if (amountCents) params.amount = amountCents
  const refund = await stripe.refunds.create(params)
  return `Refund issued: $${((refund.amount || 0) / 100).toFixed(2)} (ID: ${refund.id}, status: ${refund.status})`
}

export async function listSubscriptions(customerId?: string, status?: string): Promise<string> {
  const stripe = getStripe()
  const params: Stripe.SubscriptionListParams = { limit: 20 }
  if (customerId) params.customer = customerId
  if (status) params.status = status as Stripe.SubscriptionListParams.Status
  const subs = await stripe.subscriptions.list(params)
  if (subs.data.length === 0) return 'No subscriptions found.'
  return subs.data
    .map((s) => {
      const item = s.items.data[0]
      const price = item?.price
      const amount = price?.unit_amount || 0
      const interval = price?.recurring?.interval || '?'
      const customer = typeof s.customer === 'string' ? s.customer : s.customer?.id
      return `[${s.id}] Customer: ${customer} — $${(amount / 100).toFixed(2)}/${interval} — ${s.status} — renews ${new Date(s.current_period_end * 1000).toLocaleDateString()}`
    })
    .join('\n')
}

export async function cancelSubscription(subscriptionId: string, atPeriodEnd = true): Promise<string> {
  const stripe = getStripe()
  if (atPeriodEnd) {
    const sub = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
    return `Subscription ${subscriptionId} will cancel at period end (${new Date(sub.current_period_end * 1000).toLocaleDateString()}).`
  }
  await stripe.subscriptions.cancel(subscriptionId)
  return `Subscription ${subscriptionId} canceled immediately.`
}
