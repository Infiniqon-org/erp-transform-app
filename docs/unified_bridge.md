# Unified Bridge Implementation

## Overview
The Unified Bridge is a new feature that allows users to import pre-generated test data files from supported ERP systems for testing the DQ pipeline with large-scale datasets. This eliminates the need to manually upload large files for testing.

**🔐 Authentication Required**: Users must log in with valid credentials before accessing test datasets.

## Login Authentication

### Credentials
**⚠️ IMPORTANT**: Only the following credentials are valid:
```
Email: kiranparthiban2004+test@gmail.com
Password: TestPassword123!
```

### Authentication Features
- **Client-side validation** - Credentials validated in React component
- **Session-based** - Authentication clears on page refresh
- **Login modal** - Professional UI with error handling
- **Logout capability** - Users can logout and re-authenticate
- **Test environment only** - Not for production use

### User Flow with Authentication
1. User navigates to Unified Bridge tab
2. Clicks "Browse ERP Systems" → **Login modal appears**
3. Enters credentials and submits
4. On success → ERP selection modal opens
5. Selects ERP and file → Import processing begins
6. Can logout anytime via link below browse button

## Architecture

### Components Created

1. **Backend Lambda Function** (`lambda/unified_bridge/app.py`)
   - Lists available ERPs and their test files
   - Copies test files from S3 `test-data/` folder to user's temp folder
   - Triggers the normal DQ processing pipeline
   - API Endpoints:
     - `GET /unified-bridge/erps` - List all ERPs
     - `GET /unified-bridge/files?erp={name}` - List files for an ERP
     - `POST /unified-bridge/import` - Import a file to DQ pipeline

2. **Test Data Generator** (`generate_test_data.py`)
   - Generates Oracle Fusion test files with DQ errors
   - Creates 4 test files:
     - `oracle-10k-customers.csv` (10K rows, ~1.5 MB)
     - `oracle-50k-customers.csv` (50K rows, ~7.6 MB)
     - `oracle-200k-sales.csv` (200K rows, ~32 MB)
     - `oracle-1mln-invoices.csv` (1M rows, ~176 MB)

3. **React UI Component** (`test-reactui/src/components/UnifiedBridgeSection.jsx`)
   - Displays 11 ERP systems in a grid
   - Shows available files for Oracle (others coming soon)
   - Import button triggers file processing

4. **API Service Methods** (`test-reactui/src/services/apiService.js`)
   - `getUnifiedBridgeErps()` - Fetch ERP list
   - `getUnifiedBridgeFiles(erpName)` - Fetch files for ERP
   - `importUnifiedBridgeFile(fileId, erpName)` - Import file

5. **Updated Upload Section** (`test-reactui/src/components/UploadSection.jsx`)
   - Added 3-tab mode selector: Upload File | Import from ERP | Unified Bridge
   - Each mode displays appropriate UI

6. **CDK Infrastructure** (`stacks/auth_api.py`)
   - Added Unified Bridge Lambda function
   - Configured API Gateway endpoints with Cognito auth
   - Granted S3 and DynamoDB permissions

## Supported ERPs

Currently available:
- **Oracle Fusion** ✅ (4 test files)

Coming soon:
- SAP ERP
- Microsoft Dynamics
- NetSuite
- Infor M3
- Infor LN
- Epicor Kinetic
- Workday
- QAD ERP
- IFS Cloud
- Sage Intacct

## Setup Instructions

### Step 1: Generate Test Data
```bash
# Run the test data generator
python generate_test_data.py
```

This creates 4 Oracle test files in the `test-data/` directory with synthetic data including intentional DQ errors.

### Step 2: Upload Test Files to S3
```powershell
# In PowerShell (with mcc-project conda environment)
.\upload_test_data.ps1
```

Or manually:
```bash
# Get bucket name
aws s3 ls | findstr cleanflowai

# Upload files
aws s3 cp test-data/ s3://YOUR-BUCKET-NAME/test-data/ --recursive
```

### Step 3: Deploy Infrastructure
```bash
# Deploy CDK stack
cdk deploy auth-api
```

This deploys:
- Unified Bridge Lambda function
- Three new API Gateway endpoints
- IAM permissions for S3 and DynamoDB access

### Step 4: Test in UI
1. Open the React UI
2. Navigate to the Upload section
3. Click the "Unified Bridge" tab
4. Click "Browse ERP Systems" → **Login modal appears**
5. **Enter credentials:**
   - Email: `kiranparthiban2004+test@gmail.com`
   - Password: `TestPassword123!`
6. Click "Login" → Success notification shows
7. Select "Oracle Fusion" from ERP grid
8. Choose a test file (e.g., oracle-10k-customers)
9. Click "Import" → File imports successfully
10. Navigate to File Management tab to monitor processing
11. (Optional) Click "Logout from Unified Bridge" to clear session

## How It Works

### File Import Flow

1. **User Selection**
   - User browses ERPs and selects a file
   - UI calls `POST /unified-bridge/import`

2. **Backend Processing**
   ```
   Unified Bridge Lambda
   ├── Validates file exists in S3
   ├── Generates unique upload_id
   ├── Copies file from test-data/ to user's temp folder
   │   Source: s3://bucket/test-data/oracle-10k-customers.csv
   │   Dest: s3://bucket/data/{user_id}/temp/{upload_id}/oracle-10k-customers.csv
   └── Creates file registry entry in DynamoDB
   ```

3. **Automatic Processing**
   ```
   S3 Event Notification
   ├── Triggers File Validator Lambda
   ├── Detects Oracle format and customers entity
   ├── Validates file structure
   └── Starts DQ Pipeline via Step Functions
   ```

4. **DQ Processing**
   ```
   DQ Pipeline
   ├── Lambda AI Engine (< 1GB) or
   ├── Glue Polars Job (1-50GB) or
   ├── Glue Spark Job (> 50GB)
   └── Produces cleaned data + DQ report
   ```

5. **Results**
   - Processed files appear in File Management tab
   - User can preview, download, or export to ERP

## Test Files Details

### Oracle Fusion Test Files

| File | Rows | Size | Entity | Description |
|------|------|------|--------|-------------|
| oracle-10k-customers | 10,000 | 1.5 MB | customers | Small dataset for quick testing |
| oracle-50k-customers | 50,000 | 7.6 MB | customers | Medium dataset |
| oracle-200k-sales | 200,000 | 32 MB | sales_orders | Large dataset with complex structure |
| oracle-1mln-invoices | 1,000,000 | 176 MB | invoices | Very large dataset for stress testing |

### DQ Error Types Injected

- **Missing Required Fields** (30% of rows)
- **Invalid Dates** (malformed, future dates)
- **Invalid Currency/Status** codes
- **Long Text** (exceeding limits)
- **Injection Attacks** (HTML, SQL)
- **Invalid Characters** in IDs
- **Calculation Mismatches** (totals vs line items)

## UI Features

### Login Modal (NEW)
- **Appearance**: Professional design with blue gradient theme
- **Fields**: Email and password (both required)
- **Validation**: Client-side credential check
- **Error Handling**: Red error message for invalid credentials
- **Success**: Green notification + auto-opens ERP modal
- **Actions**: Login or Cancel buttons
- **Footer**: Security note about test environment

### Browse Button Behavior
- **Before Login**: Shows login modal on click
- **After Login**: Direct access to ERP selection
- **Logout Link**: Appears below button after authentication
- **Session**: Authentication state clears on page refresh

### ERP Selection Modal
- Grid layout showing all 11 ERPs
- Visual indicator for available ERPs
- File count badge on Oracle
- "Coming soon" indicator for others
- Only accessible after successful login

### File Selection Modal
- Displays file metadata (rows, size, entity)
- Shows filename and format
- Import button with loading state
- Availability indicator
- Real-time file size formatting

### Processing Flow
- Imports trigger same DQ pipeline as manual uploads
- Real-time status updates
- Same preview and download capabilities
- Results appear in File Management tab

## API Endpoints

### GET /unified-bridge/erps
Returns list of all ERPs with availability.

**Response:**
```json
{
  "erps": [
    {
      "name": "Oracle Fusion",
      "file_count": 4,
      "available": true
    },
    {
      "name": "SAP ERP",
      "file_count": 0,
      "available": false
    }
  ]
}
```

### GET /unified-bridge/files?erp={name}
Returns available test files for an ERP.

**Response:**
```json
{
  "erp": "Oracle Fusion",
  "files": [
    {
      "id": "oracle-10k-customers",
      "name": "Oracle - 10K Customers",
      "filename": "oracle-10k-customers.csv",
      "s3_key": "test-data/oracle-10k-customers.csv",
      "rows": 10000,
      "size_mb": 1.5,
      "entity": "customers",
      "size_bytes": 1572864,
      "last_modified": "2025-12-05T14:00:00Z",
      "available": true
    }
  ]
}
```

### POST /unified-bridge/import
Imports a test file into the DQ pipeline.

**Request:**
```json
{
  "file_id": "oracle-10k-customers",
  "erp": "Oracle Fusion"
}
```

**Response:**
```json
{
  "message": "File imported successfully",
  "upload_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "filename": "oracle-10k-customers.csv",
  "status": "UPLOADED",
  "rows": 10000,
  "erp": "Oracle Fusion",
  "entity": "customers"
}
```

## Adding New ERP Test Files

To add test files for another ERP:

1. **Generate Test Data**
   - Create CSV files following CDF schema
   - Add DQ errors for testing
   - Store in `test-data/` folder

2. **Upload to S3**
   ```bash
   aws s3 cp new-erp-file.csv s3://BUCKET/test-data/
   ```

3. **Update Lambda Configuration**
   Edit `lambda/unified_bridge/app.py`:
   ```python
   ERP_FILES = {
       "Oracle Fusion": [...],
       "SAP ERP": [
           {
               "id": "sap-10k-materials",
               "name": "SAP - 10K Materials",
               "filename": "sap-10k-materials.csv",
               "s3_key": "test-data/sap-10k-materials.csv",
               "rows": 10000,
               "size_mb": 2.5,
               "entity": "materials"
           }
       ]
   }
   ```

4. **Deploy**
   ```bash
   cdk deploy auth-api
   ```

## Benefits

1. **Faster Testing** - No need to upload large files manually
2. **Consistent Test Data** - Same datasets across team
3. **Scalability Testing** - Easy access to large files (1M+ rows)
4. **Demo Ready** - Pre-loaded data for demonstrations
5. **Multi-ERP Support** - Test different ERP formats easily

## Troubleshooting

### Files not showing in UI
- Check S3: `aws s3 ls s3://BUCKET/test-data/`
- Verify Lambda has S3 read permissions
- Check CloudWatch logs for errors

### Import fails
- Verify file exists in test-data folder
- Check file registry permissions
- Review file validator logs

### Processing stuck
- Normal for large files (1M rows = 3-7 minutes)
- Check Step Functions execution
- Monitor Glue job progress

## Future Enhancements

- [ ] Add more ERP systems (SAP, Dynamics, NetSuite)
- [ ] Support custom test file uploads
- [ ] File versioning and history
- [ ] Batch import multiple files
- [ ] Export test results comparison
- [ ] Automated DQ benchmarking

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Data Flow](./DATA_FLOW.md)
- [DQ Processing Logic](./PROCESSING_LOGIC.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)

---

**Created:** December 5, 2025
**Last Updated:** December 5, 2025
**Version:** 1.0.0
