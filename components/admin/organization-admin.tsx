import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export function OrganizationAdmin() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Name</Label>
            <input className="w-full border rounded px-3 py-2" placeholder="Acme Corp" disabled />
          </div>
          <div>
            <Label>Email</Label>
            <input className="w-full border rounded px-3 py-2" placeholder="admin@acme.com" disabled />
          </div>
          <div>
            <Label>Contact Number</Label>
            <input className="w-full border rounded px-3 py-2" placeholder="+1 555-1234" disabled />
          </div>
          <div>
            <Label>Address</Label>
            <input className="w-full border rounded px-3 py-2" placeholder="123 Main St, NY" disabled />
          </div>
        </div>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Subscription Plan</Label>
            <select className="w-full border rounded px-3 py-2" disabled>
              <option>Free</option>
              <option>Pro</option>
              <option>Enterprise</option>
            </select>
          </div>
          <div>
            <Label>Preferred Data Format</Label>
            <select className="w-full border rounded px-3 py-2" disabled>
              <option>CSV</option>
              <option>JSON</option>
              <option>XLSX</option>
              <option>SQL</option>
              <option>Parquet</option>
            </select>
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>Organization Logo</Label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-gray-400">Logo</span>
            </div>
            <Button variant="outline" disabled>Upload Logo</Button>
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>Admins</Label>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">Aashish</span>
              <span className="text-xs text-gray-500">Admin</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded">Kiran</span>
              <span className="text-xs text-gray-500">Admin</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded">Sakthi</span>
              <span className="text-xs text-gray-500">Admin</span>
            </div>
          </div>
        </div>
        <Separator />
        <Button className="w-full" disabled>Save Changes</Button>
      </CardContent>
    </Card>
  )
}
