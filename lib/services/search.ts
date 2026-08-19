import { db } from '@/db'
import {
  productionJobs,
  releases,
  panelMarks,
  customers,
  projects,
  releaseRevisions,
} from '@/db/schema'
import { eq, and, ilike, or } from 'drizzle-orm'

export interface SearchResultItem {
  id: string
  type: 'job' | 'release' | 'mark' | 'project' | 'customer'
  title: string
  subtitle: string
  status?: string
  matchReason: string
  href: string
}

export class SearchService {
  static async search(
    organizationId: string,
    rawQuery: string,
  ): Promise<SearchResultItem[]> {
    const query = rawQuery.trim()
    if (!query || query.length < 2) {
      return []
    }

    const pattern = `%${query}%`
    const results: SearchResultItem[] = []

    // 1. Search Production Jobs (5-digit job number or name)
    const matchedJobs = await db
      .select({
        id: productionJobs.id,
        jobNumber: productionJobs.jobNumber,
        name: productionJobs.name,
        status: productionJobs.status,
      })
      .from(productionJobs)
      .where(
        and(
          eq(productionJobs.organizationId, organizationId),
          or(
            ilike(productionJobs.jobNumber, pattern),
            ilike(productionJobs.name, pattern),
          ),
        ),
      )
      .limit(5)

    for (const j of matchedJobs) {
      const matchReason = j.jobNumber.includes(query)
        ? `Matched 5-digit job number: ${j.jobNumber}`
        : `Matched job name: ${j.name}`
      results.push({
        id: j.id,
        type: 'job',
        title: `Job ${j.jobNumber}`,
        subtitle: j.name,
        status: j.status,
        matchReason,
        href: `/dashboard?job=${j.jobNumber}`,
      })
    }

    // 2. Search Releases (by compound key 54120-1 or job number)
    const releaseNumberMatch = query.match(/^(\d{5})[-/ ]?(\d*)$/)
    if (releaseNumberMatch) {
      const [, targetJobNum, targetRelNum] = releaseNumberMatch
      const whereClause = targetRelNum
        ? and(
            eq(releases.organizationId, organizationId),
            eq(productionJobs.jobNumber, targetJobNum),
            eq(releases.releaseNumber, parseInt(targetRelNum, 10)),
          )
        : and(
            eq(releases.organizationId, organizationId),
            eq(productionJobs.jobNumber, targetJobNum),
          )

      const matchedReleases = await db
        .select({
          releaseId: releases.id,
          releaseNumber: releases.releaseNumber,
          status: releases.status,
          jobNumber: productionJobs.jobNumber,
          jobName: productionJobs.name,
        })
        .from(releases)
        .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
        .where(whereClause)
        .limit(3)

      for (const r of matchedReleases) {
        results.push({
          id: r.releaseId,
          type: 'release',
          title: `Release ${r.jobNumber}-${r.releaseNumber}`,
          subtitle: r.jobName,
          status: r.status,
          matchReason: `Matched Release on Job ${r.jobNumber}`,
          href: `/dashboard?job=${r.jobNumber}&release=${r.releaseNumber}`,
        })
      }
    }

    // 3. Search Panel Marks (e.g. "P-101", "ACM", color)
    const matchedMarks = await db
      .select({
        markId: panelMarks.id,
        mark: panelMarks.mark,
        description: panelMarks.description,
        materialFamily: panelMarks.materialFamily,
        color: panelMarks.color,
        revisionId: panelMarks.releaseRevisionId,
        releaseId: releaseRevisions.releaseId,
        jobNumber: productionJobs.jobNumber,
        releaseNumber: releases.releaseNumber,
      })
      .from(panelMarks)
      .innerJoin(
        releaseRevisions,
        eq(panelMarks.releaseRevisionId, releaseRevisions.id),
      )
      .innerJoin(releases, eq(releaseRevisions.releaseId, releases.id))
      .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .where(
        and(
          eq(panelMarks.organizationId, organizationId),
          or(
            ilike(panelMarks.mark, pattern),
            ilike(panelMarks.description, pattern),
            ilike(panelMarks.color, pattern),
          ),
        ),
      )
      .limit(6)

    for (const m of matchedMarks) {
      results.push({
        id: m.markId,
        type: 'mark',
        title: `Mark ${m.mark}`,
        subtitle: `${m.materialFamily} ${m.color ? `• ${m.color}` : ''} (${m.description || 'Panel'})`,
        status: `Job ${m.jobNumber} Rel ${m.releaseNumber}`,
        matchReason: m.mark.toLowerCase().includes(query.toLowerCase())
          ? `Matched panel mark: ${m.mark}`
          : `Matched description/color: ${m.color || m.description}`,
        href: `/dashboard?job=${m.jobNumber}&release=${m.releaseNumber}&mark=${m.mark}`,
      })
    }

    // 4. Search Customers & Projects
    const matchedCustomers = await db
      .select({
        id: customers.id,
        name: customers.name,
        code: customers.code,
      })
      .from(customers)
      .where(
        and(
          eq(customers.organizationId, organizationId),
          or(ilike(customers.name, pattern), ilike(customers.code, pattern)),
        ),
      )
      .limit(3)

    for (const c of matchedCustomers) {
      results.push({
        id: c.id,
        type: 'customer',
        title: c.name,
        subtitle: `Customer code: ${c.code || 'N/A'}`,
        matchReason: `Matched customer: ${c.name}`,
        href: `/dashboard?customer=${c.id}`,
      })
    }

    const matchedProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        code: projects.code,
        location: projects.location,
      })
      .from(projects)
      .where(
        and(
          eq(projects.organizationId, organizationId),
          or(ilike(projects.name, pattern), ilike(projects.code, pattern)),
        ),
      )
      .limit(3)

    for (const p of matchedProjects) {
      results.push({
        id: p.id,
        type: 'project',
        title: p.name,
        subtitle: `${p.location || 'Location not set'} (Code: ${p.code || 'N/A'})`,
        matchReason: `Matched project: ${p.name}`,
        href: `/dashboard?project=${p.id}`,
      })
    }

    return results
  }
}
