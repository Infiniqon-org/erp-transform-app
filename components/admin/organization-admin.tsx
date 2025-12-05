"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Building2, Check, Crown, Edit, Mail, MapPin, MoreHorizontal, Phone, Shield, Trash2, UserPlus, Users, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useState } from "react"

// Dummy data for members
const MEMBERS = [
  { id: 1, name: "Alice Johnson", email: "alice@acme.com", role: "Owner", status: "Active", avatar: "", joinedAt: "Jan 15, 2024" },
  { id: 2, name: "Bob Smith", email: "bob@acme.com", role: "Admin", status: "Active", avatar: "", joinedAt: "Feb 20, 2024" },
  { id: 3, name: "Clark Davis", email: "clark@acme.com", role: "Editor", status: "Active", avatar: "", joinedAt: "Mar 10, 2024" },
  { id: 4, name: "Diana Wilson", email: "diana@acme.com", role: "Viewer", status: "Active", avatar: "", joinedAt: "Apr 5, 2024" },
  { id: 5, name: "Edward Brown", email: "edward@acme.com", role: "Editor", status: "Pending", avatar: "", joinedAt: "Nov 28, 2024" },
  { id: 6, name: "Fiona Martinez", email: "fiona@acme.com", role: "Viewer", status: "Inactive", avatar: "", joinedAt: "May 12, 2024" },
]

// Permissions configuration
const PERMISSIONS = [
  { id: "files", name: "File Management", description: "Upload, download, and manage files", owner: true, admin: true, editor: true, viewer: false },
  { id: "transform", name: "Data Transformation", description: "Run and configure data transformations", owner: true, admin: true, editor: true, viewer: false },
  { id: "export", name: "Export Data", description: "Export transformed data to various formats", owner: true, admin: true, editor: true, viewer: true },
  { id: "members", name: "Manage Members", description: "Invite, remove, and manage team members", owner: true, admin: true, editor: false, viewer: false },
  { id: "billing", name: "Billing & Subscription", description: "View and manage billing information", owner: true, admin: false, editor: false, viewer: false },
  { id: "settings", name: "Organization Settings", description: "Modify organization details and preferences", owner: true, admin: true, editor: false, viewer: false },
  { id: "api", name: "API Access", description: "Generate and manage API keys", owner: true, admin: true, editor: false, viewer: false },
  { id: "audit", name: "Audit Logs", description: "View activity and audit logs", owner: true, admin: true, editor: false, viewer: false },
]

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case "Owner": return "default"
    case "Admin": return "secondary"
    case "Editor": return "outline"
    default: return "outline"
  }
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "Active": return "default"
    case "Pending": return "secondary"
    case "Inactive": return "outline"
    default: return "outline"
  }
}

export function OrganizationAdmin() {
  const [activeTab, setActiveTab] = useState("organization")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
      {/* Centered Tabs Header */}
      <div className="flex justify-center pt-2 pb-4">
        <TabsList className="inline-flex h-12 items-center justify-center rounded-xl bg-muted p-1.5 gap-1">
          <TabsTrigger 
            value="organization" 
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-8 py-2.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Building2 className="w-4 h-4" />
            <span>Organization</span>
          </TabsTrigger>
          <TabsTrigger 
            value="members" 
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-8 py-2.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Users className="w-4 h-4" />
            <span>Members</span>
          </TabsTrigger>
          <TabsTrigger 
            value="permissions" 
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-8 py-2.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Shield className="w-4 h-4" />
            <span>Permissions</span>
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Organization Settings Tab */}
      <TabsContent value="organization" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Organization Details
            </CardTitle>
            <CardDescription>
              Manage your organization's basic information and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo Section */}
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Organization Logo</h4>
                <p className="text-sm text-muted-foreground">Upload a logo for your organization</p>
                <Button variant="outline" size="sm">Upload Logo</Button>
              </div>
            </div>

            <Separator />

            {/* Organization Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input id="org-name" placeholder="Acme Corporation" defaultValue="Acme Corporation" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="org-email" className="pl-10" placeholder="contact@acme.com" defaultValue="contact@acme.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-phone">Contact Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="org-phone" className="pl-10" placeholder="+1 (555) 123-4567" defaultValue="+1 (555) 123-4567" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-address">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="org-address" className="pl-10" placeholder="123 Main St, New York, NY" defaultValue="123 Main St, New York, NY" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Subscription & Preferences */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subscription Plan</Label>
                <Select defaultValue="pro">
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Preferred Data Format</Label>
                <Select defaultValue="csv">
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="xlsx">XLSX</SelectItem>
                    <SelectItem value="sql">SQL</SelectItem>
                    <SelectItem value="parquet">Parquet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button>Save Changes</Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Members Tab */}
      <TabsContent value="members" className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team Members
              </CardTitle>
              <CardDescription>
                Manage your team members and their roles
              </CardDescription>
            </div>
            <Button className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Invite Member
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MEMBERS.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {member.name.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {member.name}
                            {member.role === "Owner" && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                          </p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={getStatusBadgeVariant(member.status)}
                        className={member.status === "Active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : ""}
                      >
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.joinedAt}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Role
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove Member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Permissions Tab */}
      <TabsContent value="permissions" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Role Permissions
            </CardTitle>
            <CardDescription>
              Configure what each role can access and do within the organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Permission</TableHead>
                  <TableHead className="text-center">Owner</TableHead>
                  <TableHead className="text-center">Admin</TableHead>
                  <TableHead className="text-center">Editor</TableHead>
                  <TableHead className="text-center">Viewer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PERMISSIONS.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{permission.name}</p>
                        <p className="text-sm text-muted-foreground">{permission.description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {permission.owner ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                            <X className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {permission.admin ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                            <X className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {permission.editor ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                            <X className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {permission.viewer ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                            <X className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Separator className="my-6" />

            <div className="flex justify-end">
              <Button>Save Permissions</Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
