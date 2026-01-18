"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Building2,
  Check,
  Crown,
  Edit,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
  Cog,
  Database,
  ShieldCheck,
  Sparkles,
  Plus,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// ERP Options
const ERP_OPTIONS = [
  { value: "quickbooks", label: "QuickBooks Online" },
  { value: "oracle", label: "Oracle Fusion" },
  { value: "sap", label: "SAP ERP" },
  { value: "dynamics", label: "Microsoft Dynamics" },
  { value: "netsuite", label: "NetSuite" },
  { value: "workday", label: "Workday" },
  { value: "infor-m3", label: "Infor M3" },
  { value: "infor-ln", label: "Infor LN" },
  { value: "epicor", label: "Epicor Kinetic" },
  { value: "qad", label: "QAD ERP" },
  { value: "ifs", label: "IFS Cloud" },
  { value: "sage", label: "Sage Intacct" },
  { value: "custom", label: "Custom ERP" },
];

// Initial organization settings
const INITIAL_ORG_SETTINGS = {
  name: "Infiniqon",
  email: "contact@infiniqon.com",
  phone: "+91 63 4567 8900",
  address: "Ekkaduthangal, Chennai, Tamil Nadu 600032",
  subscriptionPlan: "pro",
  preferredFormat: "csv",
};

// Initial services settings
const INITIAL_SERVICES_SETTINGS = {
  defaultInputErp: "quickbooks",
  defaultExportErp: "quickbooks",
  customInputErpName: "",
  customExportErpName: "",
  dataTransformEnabled: true,
  dataQualityEnabled: true,
  cleanDataShieldEnabled: false,
};

// Initial members data
const INITIAL_MEMBERS = [
  {
    id: 1,
    name: "Umashankar Sudarsan",
    email: "usudarsan@infiniqon.com",
    role: "Admin",
    status: "Active",
    avatar: "",
    joinedAt: "Jan 15, 2024",
    lastLogin: "Dec 6, 2024, 9:32 AM",
  },
  {
    id: 2,
    name: "Aashish Sankar",
    email: "asankar@infiniqon.com",
    role: "Admin",
    status: "Active",
    avatar: "",
    joinedAt: "Jan 20, 2024",
    lastLogin: "Dec 6, 2024, 10:15 AM",
  },
  {
    id: 3,
    name: "Sakthi Mahendran",
    email: "smahendran@infiniqon.com",
    role: "Admin",
    status: "Active",
    avatar: "",
    joinedAt: "Feb 5, 2024",
    lastLogin: "Online Now",
  },
  {
    id: 4,
    name: "Kiran Parthiban",
    email: "kparthiban@infiniqon.com",
    role: "Super Admin",
    status: "Active",
    avatar: "",
    joinedAt: "Feb 10, 2024",
    lastLogin: "15 mins ago",
  },
  {
    id: 5,
    name: "Priya Venkatesh",
    email: "pvenkatesh@infiniqon.com",
    role: "Data Steward",
    status: "Active",
    avatar: "",
    joinedAt: "Mar 15, 2024",
    lastLogin: "Dec 4, 2024, 2:30 PM",
  },
  {
    id: 6,
    name: "Rahul Krishnan",
    email: "rkrishnan@infiniqon.com",
    role: "Data Steward",
    status: "Active",
    avatar: "",
    joinedAt: "Apr 1, 2024",
    lastLogin: "Dec 3, 2024, 11:00 AM",
  },
  {
    id: 7,
    name: "Ananya Sharma",
    email: "asharma@infiniqon.com",
    role: "Data Steward",
    status: "Pending",
    avatar: "",
    joinedAt: "Nov 28, 2024",
    lastLogin: "Never",
  },
  {
    id: 8,
    name: "Vikram Nair",
    email: "vnair@infiniqon.com",
    role: "Data Steward",
    status: "Inactive",
    avatar: "",
    joinedAt: "May 12, 2024",
    lastLogin: "Oct 15, 2024, 3:00 PM",
  },
];

// Initial permissions configuration
const INITIAL_PERMISSIONS = [
  {
    id: "files",
    name: "File Management",
    description: "Upload, download, and manage files",
    owner: true,
    superadmin: true,
    admin: true,
    editor: true,
    viewer: false,
  },
  {
    id: "transform",
    name: "Data Transformation",
    description: "Run and configure data transformations",
    owner: true,
    superadmin: true,
    admin: true,
    editor: true,
    viewer: false,
  },
  {
    id: "export",
    name: "Export Data",
    description: "Export transformed data to various formats",
    owner: true,
    superadmin: true,
    admin: true,
    editor: true,
    viewer: true,
  },
  {
    id: "members",
    name: "Manage Members",
    description: "Invite, remove, and manage team members",
    owner: true,
    superadmin: true,
    admin: true,
    editor: false,
    viewer: false,
  },
  {
    id: "billing",
    name: "Billing & Subscription",
    description: "View and manage billing information",
    owner: true,
    superadmin: true,
    admin: false,
    editor: false,
    viewer: false,
  },
  {
    id: "settings",
    name: "Organization Settings",
    description: "Modify organization details and preferences",
    owner: true,
    superadmin: true,
    admin: true,
    editor: false,
    viewer: false,
  },
  {
    id: "api",
    name: "API Access",
    description: "Generate and manage API keys",
    owner: true,
    superadmin: true,
    admin: true,
    editor: false,
    viewer: false,
  },
  {
    id: "audit",
    name: "Audit Logs",
    description: "View activity and audit logs",
    owner: true,
    superadmin: true,
    admin: true,
    editor: false,
    viewer: false,
  },
];

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case "Owner":
      return "default";
    case "Super Admin":
      return "destructive";
    case "Admin":
      return "secondary";
    case "Editor":
      return "outline";
    default:
      return "outline";
  }
};

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "Active":
      return "default";
    case "Pending":
      return "secondary";
    case "Inactive":
      return "outline";
    default:
      return "outline";
  }
};

export function OrganizationSettings() {
  const [activeTab, setActiveTab] = useState("organization");
  const { toast } = useToast();

  // Organization settings state
  const [orgSettings, setOrgSettings] = useState(INITIAL_ORG_SETTINGS);
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  // Members state
  const [members, setMembers] = useState(INITIAL_MEMBERS);

  // Permissions state
  const [permissions, setPermissions] = useState(INITIAL_PERMISSIONS);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // Services settings state
  const [servicesSettings, setServicesSettings] = useState(
    INITIAL_SERVICES_SETTINGS
  );
  const [isSavingServices, setIsSavingServices] = useState(false);

  // Handle organization settings change
  const handleOrgChange = (field: string, value: string) => {
    setOrgSettings((prev) => ({ ...prev, [field]: value }));
  };

  // Save organization settings
  const handleSaveOrg = async () => {
    setIsSavingOrg(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSavingOrg(false);
    toast({
      title: "Settings saved",
      description: "Organization settings have been updated successfully.",
    });
  };

  // Toggle permission
  const togglePermission = (
    permissionId: string,
    role: "superadmin" | "admin" | "editor" | "viewer"
  ) => {
    setPermissions((prev) =>
      prev.map((p) => (p.id === permissionId ? { ...p, [role]: !p[role] } : p))
    );
  };

  // Save permissions
  const handleSavePermissions = async () => {
    setIsSavingPermissions(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSavingPermissions(false);
    toast({
      title: "Permissions saved",
      description: "Role permissions have been updated successfully.",
    });
  };

  // Update member role
  const updateMemberRole = (memberId: number, newRole: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
    toast({
      title: "Role updated",
      description: "Member role has been updated successfully.",
    });
  };

  // Remove member
  const removeMember = (memberId: number) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast({
      title: "Member removed",
      description: "Team member has been removed from the organization.",
    });
  };

  // Handle services settings change
  const handleServicesChange = (field: string, value: string | boolean) => {
    setServicesSettings((prev) => ({ ...prev, [field]: value }));
  };

  // Save services settings
  const handleSaveServices = async () => {
    setIsSavingServices(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSavingServices(false);
    toast({
      title: "Services saved",
      description: "Service settings have been updated successfully.",
    });
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      {/* Centered Tabs Header */}
      <div className="flex justify-center pt-2 pb-4 overflow-x-auto">
        <TabsList className="inline-flex h-10 sm:h-12 items-center justify-center rounded-xl bg-muted p-1 sm:p-1.5 gap-1">
          <TabsTrigger
            value="organization"
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-lg px-3 sm:px-6 py-2 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Organization</span>
            <span className="sm:hidden">Org</span>
          </TabsTrigger>
          <TabsTrigger
            value="members"
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-lg px-3 sm:px-6 py-2 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Users className="w-4 h-4" />
            <span>Members</span>
          </TabsTrigger>
          <TabsTrigger
            value="permissions"
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-lg px-3 sm:px-6 py-2 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Permissions</span>
            <span className="sm:hidden">Perms</span>
          </TabsTrigger>
          <TabsTrigger
            value="services"
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-lg px-3 sm:px-6 py-2 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Cog className="w-4 h-4" />
            <span>Services</span>
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
                <p className="text-sm text-muted-foreground">
                  Upload a logo for your organization
                </p>
                <Button variant="outline" size="sm">
                  Upload Logo
                </Button>
              </div>
            </div>

            <Separator />

            {/* Organization Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  placeholder="Infiniqon"
                  value={orgSettings.name}
                  onChange={(e) => handleOrgChange("name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="org-email"
                    className="pl-10"
                    placeholder="contact@infiniqon.com"
                    value={orgSettings.email}
                    onChange={(e) => handleOrgChange("email", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-phone">Contact Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="org-phone"
                    className="pl-10"
                    placeholder="+91 63 4567 8900"
                    value={orgSettings.phone}
                    onChange={(e) => handleOrgChange("phone", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-address">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="org-address"
                    className="pl-10"
                    placeholder="Ekkaduthangal, Chennai, Tamil Nadu"
                    value={orgSettings.address}
                    onChange={(e) => handleOrgChange("address", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Subscription & Preferences */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subscription Plan</Label>
                <Select
                  value={orgSettings.subscriptionPlan}
                  onValueChange={(value) =>
                    handleOrgChange("subscriptionPlan", value)
                  }
                >
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
                <Select
                  value={orgSettings.preferredFormat}
                  onValueChange={(value) =>
                    handleOrgChange("preferredFormat", value)
                  }
                >
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
              <Button onClick={handleSaveOrg} disabled={isSavingOrg}>
                {isSavingOrg && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {isSavingOrg ? "Saving..." : "Save Changes"}
              </Button>
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
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {member.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {member.name}
                            {member.role === "Owner" && (
                              <Crown className="w-3.5 h-3.5 text-amber-500" />
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {member.email}
                          </p>
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
                        className={
                          member.status === "Active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                            : ""
                        }
                      >
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.joinedAt}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {member.lastLogin}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {member.role !== "Owner" && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateMemberRole(member.id, "Super Admin")
                                }
                              >
                                Make Super Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateMemberRole(member.id, "Admin")
                                }
                              >
                                Make Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateMemberRole(member.id, "Editor")
                                }
                              >
                                Make Editor
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateMemberRole(member.id, "Viewer")
                                }
                              >
                                Make Viewer
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => removeMember(member.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remove Member
                              </DropdownMenuItem>
                            </>
                          )}
                          {member.role === "Owner" && (
                            <DropdownMenuItem disabled>
                              <Crown className="w-4 h-4 mr-2" />
                              Organization Owner
                            </DropdownMenuItem>
                          )}
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
              Configure what each role can access and do within the
              organization. Click to toggle permissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Permission</TableHead>
                  <TableHead className="text-center">Owner</TableHead>
                  <TableHead className="text-center">Super Admin</TableHead>
                  <TableHead className="text-center">Admin</TableHead>
                  <TableHead className="text-center">Editor</TableHead>
                  <TableHead className="text-center">Viewer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{permission.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {permission.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center cursor-not-allowed opacity-70">
                          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <button
                          onClick={() =>
                            togglePermission(permission.id, "superadmin")
                          }
                          className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {permission.superadmin ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                              <X className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <button
                          onClick={() =>
                            togglePermission(permission.id, "admin")
                          }
                          className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {permission.admin ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                              <X className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <button
                          onClick={() =>
                            togglePermission(permission.id, "editor")
                          }
                          className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {permission.editor ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                              <X className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <button
                          onClick={() =>
                            togglePermission(permission.id, "viewer")
                          }
                          className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {permission.viewer ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                              <X className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Separator className="my-6" />

            <div className="flex justify-end">
              <Button
                onClick={handleSavePermissions}
                disabled={isSavingPermissions}
              >
                {isSavingPermissions && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {isSavingPermissions ? "Saving..." : "Save Permissions"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Services Tab */}
      <TabsContent value="services" className="space-y-6">
        {/* ERP Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              ERP Configuration
            </CardTitle>
            <CardDescription>
              Configure default input and export ERP systems for your data
              processing workflows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Default Input ERP */}
              <div className="space-y-3">
                <Label>Default Input ERP</Label>
                <p className="text-sm text-muted-foreground">
                  Select the default ERP for data imports
                </p>
                <Select
                  value={servicesSettings.defaultInputErp}
                  onValueChange={(value) =>
                    handleServicesChange("defaultInputErp", value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select input ERP" />
                  </SelectTrigger>
                  <SelectContent>
                    {ERP_OPTIONS.map((erp) => (
                      <SelectItem key={erp.value} value={erp.value}>
                        {erp.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {servicesSettings.defaultInputErp === "custom" && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2">
                    <Input
                      placeholder="Enter custom ERP name"
                      value={servicesSettings.customInputErpName}
                      onChange={(e) =>
                        handleServicesChange(
                          "customInputErpName",
                          e.target.value
                        )
                      }
                      className="flex-1"
                    />
                    <Button size="sm" variant="outline" className="shrink-0">
                      <Plus className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                  </div>
                )}
              </div>

              {/* Default Export ERP */}
              <div className="space-y-3">
                <Label>Default Export ERP</Label>
                <p className="text-sm text-muted-foreground">
                  Select the default ERP for data exports
                </p>
                <Select
                  value={servicesSettings.defaultExportErp}
                  onValueChange={(value) =>
                    handleServicesChange("defaultExportErp", value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select export ERP" />
                  </SelectTrigger>
                  <SelectContent>
                    {ERP_OPTIONS.map((erp) => (
                      <SelectItem key={erp.value} value={erp.value}>
                        {erp.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {servicesSettings.defaultExportErp === "custom" && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2">
                    <Input
                      placeholder="Enter custom ERP name"
                      value={servicesSettings.customExportErpName}
                      onChange={(e) =>
                        handleServicesChange(
                          "customExportErpName",
                          e.target.value
                        )
                      }
                      className="flex-1"
                    />
                    <Button size="sm" variant="outline" className="shrink-0">
                      <Plus className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cog className="w-5 h-5" />
              Services
            </CardTitle>
            <CardDescription>
              Enable or disable data processing services for your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Data Transform */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg shrink-0">
                  <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-medium text-sm sm:text-base">
                    Data Transform
                  </h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Transform and normalize data between different ERP formats
                  </p>
                </div>
              </div>
              <Switch
                checked={servicesSettings.dataTransformEnabled}
                onCheckedChange={(checked) =>
                  handleServicesChange("dataTransformEnabled", checked)
                }
                className="shrink-0"
              />
            </div>

            {/* Data Quality */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 bg-green-100 dark:bg-green-500/20 rounded-lg shrink-0">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-medium text-sm sm:text-base">
                    Data Quality
                  </h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Validate, clean, and fix data quality issues automatically
                  </p>
                </div>
              </div>
              <Switch
                checked={servicesSettings.dataQualityEnabled}
                onCheckedChange={(checked) =>
                  handleServicesChange("dataQualityEnabled", checked)
                }
                className="shrink-0"
              />
            </div>

            {/* CleanDataShield */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg shrink-0">
                  <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-sm sm:text-base">
                      CleanDataShield™
                    </h4>
                    <Badge variant="secondary" className="text-xs">
                      Premium
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Distributed Proxy & Privacy Layer — Work with AI without
                    giving away your data
                  </p>
                </div>
              </div>
              <Switch
                checked={servicesSettings.cleanDataShieldEnabled}
                onCheckedChange={(checked) =>
                  handleServicesChange("cleanDataShieldEnabled", checked)
                }
                className="shrink-0"
              />
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button onClick={handleSaveServices} disabled={isSavingServices}>
                {isSavingServices && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {isSavingServices ? "Saving..." : "Save Services"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
