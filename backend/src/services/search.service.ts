import { Client } from '@elastic/elasticsearch'
import { config } from '../config/env'
import { EmailRecord } from '../types'

let esClient: Client | null = null
let isEsAvailable = false

export function getElasticsearchClient(): Client {
  if (!esClient) {
    esClient = new Client({
      node: config.elasticsearch.node,
      maxRetries: 3,
      requestTimeout: 4000,
    })
  }
  return esClient
}

export async function initElasticsearch(): Promise<void> {
  const client = getElasticsearchClient()
  try {
    const ping = await client.ping()
    if (ping) {
      isEsAvailable = true
      console.log(`✅ Connected to Elasticsearch at ${config.elasticsearch.node}`)

      const indexExists = await client.indices.exists({ index: config.elasticsearch.index })
      if (!indexExists) {
        await client.indices.create({
          index: config.elasticsearch.index,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                recipientName: { type: 'text' },
                sender: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                subject: { type: 'text' },
                body: { type: 'text' },
                bodyPreview: { type: 'text' },
                status: { type: 'keyword' },
                scheduledAt: { type: 'date' },
                sentAt: { type: 'date' },
                createdAt: { type: 'date' },
                previewUrl: { type: 'keyword', index: false },
              },
            },
          },
        })
        console.log(`✅ Elasticsearch index "${config.elasticsearch.index}" created with mapping.`)
      }
    }
  } catch (err: any) {
    isEsAvailable = false
    console.warn(`⚠️ Elasticsearch not reachable at ${config.elasticsearch.node} (${err.message}). Full-text search will automatically fall back to SQL ILIKE.`)
  }
}

export async function indexEmail(email: EmailRecord): Promise<void> {
  if (!isEsAvailable) return
  try {
    const client = getElasticsearchClient()
    await client.index({
      index: config.elasticsearch.index,
      id: email.id,
      document: {
        id: email.id,
        recipient: email.recipientEmail,
        recipientName: email.recipientName,
        sender: email.senderEmail,
        subject: email.subject,
        body: email.body,
        bodyPreview: email.bodyPreview,
        status: email.status,
        scheduledAt: email.scheduledAt ? new Date(email.scheduledAt).toISOString() : null,
        sentAt: email.sentAt ? new Date(email.sentAt).toISOString() : null,
        createdAt: email.createdAt ? new Date(email.createdAt).toISOString() : new Date().toISOString(),
        previewUrl: email.previewUrl || null,
      },
      refresh: 'wait_for',
    })
  } catch (err: any) {
    console.warn(`[Elasticsearch] Failed to index email ${email.id}: ${err.message}`)
  }
}

export async function updateEmailInSearch(id: string, partial: Record<string, any>): Promise<void> {
  if (!isEsAvailable) return
  try {
    const client = getElasticsearchClient()
    await client.update({
      index: config.elasticsearch.index,
      id,
      doc: partial,
      refresh: 'wait_for',
    })
  } catch (err: any) {
    console.warn(`[Elasticsearch] Failed to update search document ${id}: ${err.message}`)
  }
}

export async function deleteEmailFromSearch(id: string): Promise<void> {
  if (!isEsAvailable) return
  try {
    const client = getElasticsearchClient()
    await client.delete({
      index: config.elasticsearch.index,
      id,
      refresh: 'wait_for',
    })
  } catch (err: any) {
    console.warn(`[Elasticsearch] Failed to delete search document ${id}: ${err.message}`)
  }
}

export async function searchEmailsWithES(params: {
  query?: string
  status?: string
  page?: number
  limit?: number
}): Promise<{ ids: string[]; total: number } | null> {
  if (!isEsAvailable) return null

  try {
    const client = getElasticsearchClient()
    const page = Math.max(1, params.page || 1)
    const limit = Math.max(1, Math.min(100, params.limit || 20))
    const from = (page - 1) * limit

    const must: any[] = []
    if (params.status) {
      must.push({ term: { status: params.status } })
    }

    const should: any[] = []
    if (params.query && params.query.trim()) {
      should.push({
        multi_match: {
          query: params.query.trim(),
          fields: ['subject^3', 'recipientName^2', 'recipient^2', 'body', 'bodyPreview', 'sender'],
          fuzziness: 'AUTO',
        },
      })
    }

    const sortField = params.status === 'sent' ? 'sentAt' : 'scheduledAt'

    const response = await client.search({
      index: config.elasticsearch.index,
      query: {
        bool: {
          must,
          should,
          minimum_should_match: should.length > 0 ? 1 : 0,
        },
      },
      sort: [{ [sortField]: { order: 'desc', missing: '_last' } }],
      from,
      size: limit,
    })

    const hits = response.hits.hits
    const total = typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value || 0
    const ids = hits.map((h: any) => h._id)

    return { ids, total }
  } catch (err: any) {
    console.warn(`[Elasticsearch] Search query failed (${err.message}). Falling back to DB search.`)
    return null
  }
}
