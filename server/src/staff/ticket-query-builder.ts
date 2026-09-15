import type { Prisma, Priority, TicketStatus } from '@prisma/client'
import type { SortDirection, TicketSortField } from '@toktickit/shared'

export type TicketQueryResult = {
  where: Prisma.TicketWhereInput
  orderBy: Prisma.TicketOrderByWithRelationInput[]
  skip: number
  take: number
}

/**
 * Builder: the IT Staff Queue's search/filter/sort/paginate combination is
 * naturally step-by-step rather than one large conditional query object
 * (specification.md §9). Every setter takes an already-validated value --
 * the allowlist check (BR-L3-11) happens once in the route handler that
 * parses the query string, not here, so this class never has to guess
 * whether a field name is safe to interpolate.
 */
export class TicketQueryBuilder {
  private where: Prisma.TicketWhereInput = {}
  private orderField: TicketSortField = 'createdAt'
  private orderDir: SortDirection = 'desc'
  private pageNum = 1
  private pageSizeNum = 10

  withSearch(term?: string): this {
    if (term) {
      this.where.OR = [
        { ticketNumber: { contains: term, mode: 'insensitive' } },
        { summary: { contains: term, mode: 'insensitive' } },
      ]
    }
    return this
  }

  withCategory(categoryId?: number): this {
    if (categoryId !== undefined) this.where.categoryId = categoryId
    return this
  }

  withRequestedPriority(priority?: Priority): this {
    if (priority) this.where.requestedPriority = priority
    return this
  }

  withItPriority(priority?: Priority): this {
    if (priority) this.where.itPriority = priority
    return this
  }

  withStatus(status?: TicketStatus): this {
    if (status) this.where.currentStatus = status
    return this
  }

  /** Ignored when `unassignedOnly` also applies -- see that method. */
  withTicketOwner(ticketOwnerId?: number): this {
    if (ticketOwnerId !== undefined) this.where.ticketOwnerId = ticketOwnerId
    return this
  }

  unassignedOnly(flag?: boolean): this {
    if (flag) this.where.ticketOwnerId = null
    return this
  }

  sortBy(field: TicketSortField, direction: SortDirection): this {
    this.orderField = field
    this.orderDir = direction
    return this
  }

  paginate(page: number, pageSize: number): this {
    this.pageNum = page
    this.pageSizeNum = pageSize
    return this
  }

  build(): TicketQueryResult {
    return {
      where: this.where,
      // id desc as a stable secondary sort, same convention as Lab 2's
      // Requester-scoped ticket list.
      orderBy: [{ [this.orderField]: this.orderDir }, { id: 'desc' }],
      skip: (this.pageNum - 1) * this.pageSizeNum,
      take: this.pageSizeNum,
    }
  }
}
