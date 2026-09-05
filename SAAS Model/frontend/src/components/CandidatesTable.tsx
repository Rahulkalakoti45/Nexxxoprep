import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CandidateRow } from "../types/dashboard";
import { formatDateTime } from "../lib/utils";
import { Badge, statusBadgeVariant } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input, Select } from "./ui/input";
import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { EmptyState } from "./EmptyState";

const STATUS_OPTIONS = [
  "",
  "SHORTLISTED",
  "INVITED",
  "INTERVIEW_STARTED",
  "INTERVIEW_COMPLETED",
  "FINAL_SELECTED",
  "REJECTED",
];

const PAGE_SIZE = 10;

export function CandidatesTable({
  items,
  loading,
  search,
  status,
  onSearchChange,
  onStatusChange,
  showFilters = true,
  title = "Candidates",
}: {
  items: CandidateRow[];
  loading?: boolean;
  search: string;
  status: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  showFilters?: boolean;
  title?: string;
}) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, status, items.length]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
        {showFilters ? (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="h-10 pl-9"
                placeholder="Search by name or email"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>
            <Select
              value={status}
              onChange={(event) => onStatusChange(event.target.value)}
              className="sm:w-56"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option || "all"} value={option}>
                  {option ? option.replace(/_/g, " ") : "All statuses"}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="No candidates found" description="Try adjusting search or status filters." />
        ) : (
          <>
            <div className="max-h-[480px] overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Resume Score</TableHead>
                    <TableHead>Current Status</TableHead>
                    <TableHead>Email Status</TableHead>
                    <TableHead>Interview Expiry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <TableCell className="font-medium">{candidate.name}</TableCell>
                      <TableCell className="text-muted-foreground">{candidate.email}</TableCell>
                      <TableCell>{candidate.resume_score ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(candidate.candidate_status)}>
                          {candidate.candidate_status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(candidate.email_status)}>
                          {candidate.email_status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(candidate.interview_expires_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, items.length)} of{" "}
                {items.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
