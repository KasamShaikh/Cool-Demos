@description('Location for all resources')
param location string = resourceGroup().location

@description('Unique suffix for resource names')
param suffix string = uniqueString(resourceGroup().id)

@description('Azure AI Foundry project name')
param aiProjectName string = 'fd-scraper-ai-${suffix}'

@description('Storage account name')
param storageAccountName string = 'fdrates${suffix}'

@description('Blob container name')
param containerName string = 'fd-rates'

// ── Storage Account ──────────────────────────────────────────────
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: containerName
  properties: {
    publicAccess: 'None'
  }
}

// ── AI Services (for Foundry) ────────────────────────────────────
resource aiServices 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: aiProjectName
  location: location
  kind: 'AIServices'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: aiProjectName
    publicNetworkAccess: 'Enabled'
  }
}

// ── Model Deployment (GPT-4o) ────────────────────────────────────
resource gpt4oDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: aiServices
  name: 'gpt-4o'
  sku: {
    name: 'Standard'
    capacity: 30
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o'
      version: '2024-11-20'
    }
  }
}

// ── Outputs ──────────────────────────────────────────────────────
output storageAccountName string = storageAccount.name
output storageConnectionString string = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
output aiServicesEndpoint string = aiServices.properties.endpoint
output aiServicesName string = aiServices.name
