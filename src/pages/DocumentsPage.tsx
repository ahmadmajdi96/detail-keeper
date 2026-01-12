import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Upload,
  Search,
  Filter,
  FileType,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  Eye,
  Download,
  Trash2,
} from "lucide-react";
import { Document, DocumentStatus } from "@/types";

// Mock data
const mockDocuments: Document[] = [
  {
    doc_id: "1",
    filename: "product_requirements_v2.pdf",
    uploader_id: "1",
    project_id: "1",
    file_size: 2450000,
    mime_type: "application/pdf",
    status: "processed",
    processed_date: "2024-01-15T10:30:00",
    created_date: "2024-01-15T10:25:00",
    requirements_count: 47,
  },
  {
    doc_id: "2",
    filename: "user_stories_sprint_23.docx",
    uploader_id: "2",
    project_id: "1",
    file_size: 890000,
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    status: "processing",
    created_date: "2024-01-16T09:15:00",
    requirements_count: 0,
  },
  {
    doc_id: "3",
    filename: "api_specification.pdf",
    uploader_id: "1",
    project_id: "2",
    file_size: 5200000,
    mime_type: "application/pdf",
    status: "processed",
    processed_date: "2024-01-14T14:45:00",
    created_date: "2024-01-14T14:30:00",
    requirements_count: 82,
  },
  {
    doc_id: "4",
    filename: "test_cases_legacy.xlsx",
    uploader_id: "3",
    project_id: "1",
    file_size: 1200000,
    mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    status: "failed",
    created_date: "2024-01-16T11:00:00",
    requirements_count: 0,
  },
  {
    doc_id: "5",
    filename: "security_requirements.pdf",
    uploader_id: "1",
    project_id: "3",
    file_size: 980000,
    mime_type: "application/pdf",
    status: "processed",
    processed_date: "2024-01-13T16:20:00",
    created_date: "2024-01-13T16:10:00",
    requirements_count: 23,
  },
];

export default function DocumentsPage() {
  const [documents] = useState<Document[]>(mockDocuments);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDragging, setIsDragging] = useState(false);

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1000000) return `${(bytes / 1000000).toFixed(1)} MB`;
    if (bytes >= 1000) return `${(bytes / 1000).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case "processed":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-info animate-spin" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusVariant = (status: DocumentStatus) => {
    switch (status) {
      case "processed": return "success";
      case "processing": return "info";
      case "failed": return "destructive";
      default: return "default";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Handle file drop
  };

  return (
    <AppLayout>
      <PageHeader
        title="Document Processing"
        description="Upload and analyze documents to extract testable requirements"
        isAIPowered
      />

      {/* Upload Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <Card
          className={`border-2 border-dashed transition-all duration-200 ${
            isDragging
              ? "border-accent bg-accent/5"
              : "border-border hover:border-accent/50"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CardContent className="flex flex-col items-center justify-center py-10">
            <div className={`flex h-14 w-14 items-center justify-center rounded-xl mb-4 transition-all ${
              isDragging ? "ai-gradient ai-glow" : "bg-secondary"
            }`}>
              <Upload className={`h-6 w-6 ${isDragging ? "text-white" : "text-muted-foreground"}`} />
            </div>
            <h3 className="text-lg font-medium mb-1">Upload Documents</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
              Drag and drop your files here, or click to browse. AI will automatically extract requirements.
            </p>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary">PDF</Badge>
              <Badge variant="secondary">DOCX</Badge>
              <Badge variant="secondary">XLSX</Badge>
            </div>
            <Button className="ai-gradient text-white">
              <Upload className="mr-2 h-4 w-4" />
              Choose Files
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Processing Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 md:grid-cols-4 mb-6"
      >
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{documents.length}</p>
                <p className="text-xs text-muted-foreground">Total Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{documents.filter(d => d.status === "processed").length}</p>
                <p className="text-xs text-muted-foreground">Processed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                <Loader2 className="h-5 w-5 text-info animate-spin" />
              </div>
              <div>
                <p className="text-2xl font-bold">{documents.filter(d => d.status === "processing").length}</p>
                <p className="text-xs text-muted-foreground">Processing</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg ai-gradient">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {documents.reduce((sum, d) => sum + (d.requirements_count || 0), 0)}
                </p>
                <p className="text-xs text-muted-foreground">Requirements Extracted</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="uploaded">Uploaded</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Documents Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requirements</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.doc_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                          <FileType className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{doc.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.mime_type.split("/").pop()?.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(doc.status)}
                        <StatusBadge variant={getStatusVariant(doc.status)} size="sm">
                          {doc.status}
                        </StatusBadge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {doc.status === "processed" ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Sparkles className="h-3 w-3 text-accent" />
                          {doc.requirements_count} found
                        </div>
                      ) : doc.status === "processing" ? (
                        <span className="text-sm text-muted-foreground">Analyzing...</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatFileSize(doc.file_size)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(doc.created_date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
}
