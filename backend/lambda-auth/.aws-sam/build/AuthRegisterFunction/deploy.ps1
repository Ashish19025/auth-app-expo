[CmdletBinding()]
param(
  [string]$StackName = 'auth-app-expo-auth',
  [string]$Region = 'ap-southeast-2',
  [string]$UsersTableName = 'Users',
  [string]$SessionsTableName = 'Sessions',
  [string]$TermsTableName = 'Terms',
  [string]$UserTermsTableName = 'UserTerms',
  [string]$JwtIssuer = 'auth-app-expo',
  [string]$JwtAudience = 'auth-app-expo-users',
  [string]$FirebaseSecretArn = $env:FIREBASE_SECRET_ARN,
  [string]$JwtSecretArn = $env:JWT_SECRET_ARN
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $root

if (-not $FirebaseSecretArn) {
  throw 'Set FIREBASE_SECRET_ARN or pass -FirebaseSecretArn.'
}

if (-not $JwtSecretArn) {
  throw 'Set JWT_SECRET_ARN or pass -JwtSecretArn.'
}

$parameterOverrides = @(
  "UsersTableName=$UsersTableName",
  "SessionsTableName=$SessionsTableName",
  "TermsTableName=$TermsTableName",
  "UserTermsTableName=$UserTermsTableName",
  "FirebaseSecretArn=$FirebaseSecretArn",
  "JwtSecretArn=$JwtSecretArn",
  "JwtIssuer=$JwtIssuer",
  "JwtAudience=$JwtAudience"
) -join ' '

Write-Host "Building SAM application..."
sam build

Write-Host "Deploying stack $StackName to $Region..."

sam deploy `
  --stack-name $StackName `
  --region $Region `
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM `
  --no-confirm-changeset `
  --no-fail-on-empty-changeset `
  --resolve-s3 `
  --parameter-overrides $parameterOverrides

Write-Host "Deployment completed."