{
  "openapi": "3.1.0",
  "info": {
    "title": "ERP to CDF Transformation API v2.0",
    "description": "High-performance ERP data transformation using Polars and DuckDB",
    "version": "2.0.0"
  },
  "paths": {
    "/health": {
      "get": {
        "tags": [
          "Health"
        ],
        "summary": "Health Check",
        "description": "Health check endpoint.",
        "operationId": "health_check_health_get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {

                }
              }
            }
          }
        }
      }
    },
    "/entities": {
      "get": {
        "tags": [
          "Information"
        ],
        "summary": "Get Entities",
        "description": "Get list of supported entity types.",
        "operationId": "get_entities_entities_get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "items": {
                    "type": "string"
                  },
                  "type": "array",
                  "title": "Response Get Entities Entities Get"
                }
              }
            }
          }
        }
      }
    },
    "/erps": {
      "get": {
        "tags": [
          "Information"
        ],
        "summary": "Get Erps",
        "description": "Get list of supported ERP systems.",
        "operationId": "get_erps_erps_get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "items": {
                    "type": "string"
                  },
                  "type": "array",
                  "title": "Response Get Erps Erps Get"
                }
              }
            }
          }
        }
      }
    },
    "/formats": {
      "get": {
        "tags": [
          "Information"
        ],
        "summary": "Get Supported Formats",
        "description": "Get list of supported file formats.",
        "operationId": "get_supported_formats_formats_get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "items": {
                    "type": "string"
                  },
                  "type": "array",
                  "title": "Response Get Supported Formats Formats Get"
                }
              }
            }
          }
        }
      }
    },
    "/formats/processing": {
      "get": {
        "tags": [
          "Information"
        ],
        "summary": "Get Format Processing Methods",
        "description": "Get processing methods for each file format (in-memory vs temp-file).",
        "operationId": "get_format_processing_methods_formats_processing_get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {

                }
              }
            }
          }
        }
      }
    },
    "/transform": {
      "post": {
        "tags": [
          "Transformation"
        ],
        "summary": "Transform Data",
        "description": "Transform JSON data to CDF format.\n\nThis endpoint accepts JSON data directly and transforms it according to the request parameters.\nUses completely in-memory processing for better performance and security.",
        "operationId": "transform_data_transform_post",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/TransformationRequestModel"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/TransformationResponseModel"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/transform/file": {
      "post": {
        "tags": [
          "Transformation"
        ],
        "summary": "Transform File",
        "description": "Transform uploaded file to CDF format.\n\nThis endpoint accepts file uploads and transforms them according to the request parameters.\nSupports CSV, Excel, JSON, and SQL files.",
        "operationId": "transform_file_transform_file_post",
        "requestBody": {
          "content": {
            "multipart/form-data": {
              "schema": {
                "$ref": "#/components/schemas/Body_transform_file_transform_file_post"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/TransformationResponseModel"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/transform/file/download": {
      "post": {
        "tags": [
          "Transformation"
        ],
        "summary": "Transform File Download",
        "description": "Transform uploaded file and return as downloadable file.\n\nThis endpoint transforms the file and returns the result as a downloadable file.",
        "operationId": "transform_file_download_transform_file_download_post",
        "requestBody": {
          "content": {
            "multipart/form-data": {
              "schema": {
                "$ref": "#/components/schemas/Body_transform_file_download_transform_file_download_post"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {

                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/llm_pure/transform": {
      "post": {
        "tags": [
          "Pure LLM Transformation"
        ],
        "summary": "Pure Llm Transform Data",
        "description": "Transform JSON data to CDF format using Pure LLM approach.\n\nThis endpoint uses only LLM-based mapping when ERP or Entity is unknown, \nwith enhanced template context and 5 retry attempts.",
        "operationId": "pure_llm_transform_data_llm_pure_transform_post",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/TransformationRequestModel"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/TransformationResponseModel"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/llm_pure/transform/file": {
      "post": {
        "tags": [
          "Pure LLM Transformation"
        ],
        "summary": "Pure Llm Transform File",
        "description": "Transform uploaded file to CDF format using Pure LLM approach.\n\nThis endpoint uses only LLM-based mapping when ERP or Entity is unknown,\nwith enhanced template context and 5 retry attempts.",
        "operationId": "pure_llm_transform_file_llm_pure_transform_file_post",
        "requestBody": {
          "content": {
            "multipart/form-data": {
              "schema": {
                "$ref": "#/components/schemas/Body_pure_llm_transform_file_llm_pure_transform_file_post"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/TransformationResponseModel"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/llm_pure/transform/file/download": {
      "post": {
        "tags": [
          "Pure LLM Transformation"
        ],
        "summary": "Pure Llm Transform File Download",
        "description": "Transform uploaded file and return as downloadable file using Pure LLM approach.\n\nThis endpoint uses only LLM-based mapping when ERP or Entity is unknown,\nwith enhanced template context and 5 retry attempts.",
        "operationId": "pure_llm_transform_file_download_llm_pure_transform_file_download_post",
        "requestBody": {
          "content": {
            "multipart/form-data": {
              "schema": {
                "$ref": "#/components/schemas/Body_pure_llm_transform_file_download_llm_pure_transform_file_download_post"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {

                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/analyze": {
      "post": {
        "tags": [
          "Analysis"
        ],
        "summary": "Analyze Data",
        "description": "Analyze uploaded file and provide insights.\n\nThis endpoint analyzes the file structure and suggests possible ERP/entity combinations.",
        "operationId": "analyze_data_analyze_post",
        "requestBody": {
          "content": {
            "multipart/form-data": {
              "schema": {
                "$ref": "#/components/schemas/Body_analyze_data_analyze_post"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AnalysisResponseModel"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/llm_pure/analyze": {
      "post": {
        "tags": [
          "Pure LLM Analysis"
        ],
        "summary": "Pure Llm Analyze Data",
        "description": "Analyze uploaded file using Pure LLM approach.\n\nThis endpoint analyzes the file structure for Pure LLM transformation.",
        "operationId": "pure_llm_analyze_data_llm_pure_analyze_post",
        "requestBody": {
          "content": {
            "multipart/form-data": {
              "schema": {
                "$ref": "#/components/schemas/Body_pure_llm_analyze_data_llm_pure_analyze_post"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AnalysisResponseModel"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/validate": {
      "post": {
        "tags": [
          "Validation"
        ],
        "summary": "Validate Data",
        "description": "Validate file structure and content.\n\nThis endpoint validates the file can be loaded and provides basic statistics.",
        "operationId": "validate_data_validate_post",
        "requestBody": {
          "content": {
            "multipart/form-data": {
              "schema": {
                "$ref": "#/components/schemas/Body_validate_data_validate_post"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {

                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/template/erp/{erp}/entity/{entity}": {
      "get": {
        "tags": [
          "Template"
        ],
        "summary": "Get Template Mapping",
        "description": "Get template mapping for specific ERP and entity.",
        "operationId": "get_template_mapping_template_erp__erp__entity__entity__get",
        "parameters": [
          {
            "name": "erp",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "title": "Erp"
            }
          },
          {
            "name": "entity",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "title": "Entity"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {

                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/template/entity/{entity}/schema": {
      "get": {
        "tags": [
          "Template"
        ],
        "summary": "Get Entity Schema",
        "description": "Get CDF schema for specific entity.",
        "operationId": "get_entity_schema_template_entity__entity__schema_get",
        "parameters": [
          {
            "name": "entity",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "title": "Entity"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {

                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "AnalysisResponseModel": {
        "properties": {
          "column_info": {
            "additionalProperties": true,
            "type": "object",
            "title": "Column Info"
          },
          "erp_entity_suggestions": {
            "items": {
              "additionalProperties": true,
              "type": "object"
            },
            "type": "array",
            "title": "Erp Entity Suggestions"
          },
          "available_entities": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Available Entities"
          },
          "available_erps": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Available Erps"
          },
          "processing_time_ms": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ],
            "title": "Processing Time Ms"
          }
        },
        "type": "object",
        "required": [
          "column_info",
          "erp_entity_suggestions",
          "available_entities",
          "available_erps"
        ],
        "title": "AnalysisResponseModel",
        "description": "API model for data analysis responses."
      },
      "Body_analyze_data_analyze_post": {
        "properties": {
          "file": {
            "type": "string",
            "format": "binary",
            "title": "File",
            "description": "File to analyze"
          }
        },
        "type": "object",
        "required": [
          "file"
        ],
        "title": "Body_analyze_data_analyze_post"
      },
      "Body_pure_llm_analyze_data_llm_pure_analyze_post": {
        "properties": {
          "file": {
            "type": "string",
            "format": "binary",
            "title": "File",
            "description": "File to analyze"
          }
        },
        "type": "object",
        "required": [
          "file"
        ],
        "title": "Body_pure_llm_analyze_data_llm_pure_analyze_post"
      },
      "Body_pure_llm_transform_file_download_llm_pure_transform_file_download_post": {
        "properties": {
          "file": {
            "type": "string",
            "format": "binary",
            "title": "File",
            "description": "File to transform"
          },
          "auto_select_erp": {
            "type": "boolean",
            "title": "Auto Select Erp",
            "description": "Auto-detect ERP system",
            "default": true
          },
          "auto_select_entity": {
            "type": "boolean",
            "title": "Auto Select Entity",
            "description": "Auto-detect entity type",
            "default": true
          },
          "entity": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Entity",
            "description": "Entity type (if known)"
          },
          "erp": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Erp",
            "description": "ERP system (if known)"
          },
          "output_format": {
            "type": "string",
            "title": "Output Format",
            "description": "Output format (csv, json, parquet)",
            "default": "csv"
          }
        },
        "type": "object",
        "required": [
          "file"
        ],
        "title": "Body_pure_llm_transform_file_download_llm_pure_transform_file_download_post"
      },
      "Body_pure_llm_transform_file_llm_pure_transform_file_post": {
        "properties": {
          "file": {
            "type": "string",
            "format": "binary",
            "title": "File",
            "description": "File to transform"
          },
          "auto_select_erp": {
            "type": "boolean",
            "title": "Auto Select Erp",
            "description": "Auto-detect ERP system",
            "default": true
          },
          "auto_select_entity": {
            "type": "boolean",
            "title": "Auto Select Entity",
            "description": "Auto-detect entity type",
            "default": true
          },
          "entity": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Entity",
            "description": "Entity type (if known)"
          },
          "erp": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Erp",
            "description": "ERP system (if known)"
          },
          "output_format": {
            "type": "string",
            "title": "Output Format",
            "description": "Output format (json, csv, parquet)",
            "default": "json"
          }
        },
        "type": "object",
        "required": [
          "file"
        ],
        "title": "Body_pure_llm_transform_file_llm_pure_transform_file_post"
      },
      "Body_transform_file_download_transform_file_download_post": {
        "properties": {
          "file": {
            "type": "string",
            "format": "binary",
            "title": "File",
            "description": "File to transform"
          },
          "auto_select_erp": {
            "type": "boolean",
            "title": "Auto Select Erp",
            "description": "Auto-detect ERP system",
            "default": true
          },
          "auto_select_entity": {
            "type": "boolean",
            "title": "Auto Select Entity",
            "description": "Auto-detect entity type",
            "default": true
          },
          "entity": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Entity",
            "description": "Entity type (if known)"
          },
          "erp": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Erp",
            "description": "ERP system (if known)"
          },
          "output_format": {
            "type": "string",
            "title": "Output Format",
            "description": "Output format (csv, json, parquet)",
            "default": "csv"
          }
        },
        "type": "object",
        "required": [
          "file"
        ],
        "title": "Body_transform_file_download_transform_file_download_post"
      },
      "Body_transform_file_transform_file_post": {
        "properties": {
          "file": {
            "type": "string",
            "format": "binary",
            "title": "File",
            "description": "File to transform"
          },
          "auto_select_erp": {
            "type": "boolean",
            "title": "Auto Select Erp",
            "description": "Auto-detect ERP system",
            "default": true
          },
          "auto_select_entity": {
            "type": "boolean",
            "title": "Auto Select Entity",
            "description": "Auto-detect entity type",
            "default": true
          },
          "entity": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Entity",
            "description": "Entity type (if known)"
          },
          "erp": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Erp",
            "description": "ERP system (if known)"
          },
          "output_format": {
            "type": "string",
            "title": "Output Format",
            "description": "Output format (json, csv, parquet)",
            "default": "json"
          }
        },
        "type": "object",
        "required": [
          "file"
        ],
        "title": "Body_transform_file_transform_file_post"
      },
      "Body_validate_data_validate_post": {
        "properties": {
          "file": {
            "type": "string",
            "format": "binary",
            "title": "File",
            "description": "File to validate"
          }
        },
        "type": "object",
        "required": [
          "file"
        ],
        "title": "Body_validate_data_validate_post"
      },
      "HTTPValidationError": {
        "properties": {
          "detail": {
            "items": {
              "$ref": "#/components/schemas/ValidationError"
            },
            "type": "array",
            "title": "Detail"
          }
        },
        "type": "object",
        "title": "HTTPValidationError"
      },
      "TransformationRequestModel": {
        "properties": {
          "auto_select_erp": {
            "type": "boolean",
            "title": "Auto Select Erp",
            "description": "Auto-detect ERP system",
            "default": true
          },
          "auto_select_entity": {
            "type": "boolean",
            "title": "Auto Select Entity",
            "description": "Auto-detect entity type",
            "default": true
          },
          "entity": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Entity",
            "description": "Entity type (if known)"
          },
          "erp": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Erp",
            "description": "ERP system (if known)"
          },
          "data": {
            "anyOf": [
              {
                "items": {
                  "additionalProperties": true,
                  "type": "object"
                },
                "type": "array"
              },
              {
                "type": "null"
              }
            ],
            "title": "Data",
            "description": "JSON data (alternative to file)"
          }
        },
        "type": "object",
        "title": "TransformationRequestModel",
        "description": "API model for transformation requests."
      },
      "TransformationResponseModel": {
        "properties": {
          "success": {
            "type": "boolean",
            "title": "Success"
          },
          "data": {
            "anyOf": [
              {
                "items": {
                  "additionalProperties": true,
                  "type": "object"
                },
                "type": "array"
              },
              {
                "type": "null"
              }
            ],
            "title": "Data"
          },
          "detected_erp": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Detected Erp"
          },
          "detected_entity": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Detected Entity"
          },
          "transformation_mode": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Transformation Mode"
          },
          "confidence_score": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ],
            "title": "Confidence Score"
          },
          "message": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Message"
          },
          "column_mappings": {
            "anyOf": [
              {
                "additionalProperties": {
                  "type": "string"
                },
                "type": "object"
              },
              {
                "type": "null"
              }
            ],
            "title": "Column Mappings"
          },
          "row_count": {
            "anyOf": [
              {
                "type": "integer"
              },
              {
                "type": "null"
              }
            ],
            "title": "Row Count"
          },
          "processing_time_ms": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ],
            "title": "Processing Time Ms"
          }
        },
        "type": "object",
        "required": [
          "success"
        ],
        "title": "TransformationResponseModel",
        "description": "API model for transformation responses."
      },
      "ValidationError": {
        "properties": {
          "loc": {
            "items": {
              "anyOf": [
                {
                  "type": "string"
                },
                {
                  "type": "integer"
                }
              ]
            },
            "type": "array",
            "title": "Location"
          },
          "msg": {
            "type": "string",
            "title": "Message"
          },
          "type": {
            "type": "string",
            "title": "Error Type"
          }
        },
        "type": "object",
        "required": [
          "loc",
          "msg",
          "type"
        ],
        "title": "ValidationError"
      }
    }
  }
}