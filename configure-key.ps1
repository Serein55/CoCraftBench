$ErrorActionPreference = 'Stop'
$taskProfile = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'mindcraft\andy.json') -Raw | ConvertFrom-Json
$taskKeyName = switch ($taskProfile.model.api) {
    'openai' { 'OPENAI_API_KEY' }
    'deepseek' { 'DEEPSEEK_API_KEY' }
    default { throw 'Unsupported API provider in andy.json.' }
}
$taskSecureKey = Read-Host ('Paste the API key for ' + $taskProfile.model.url + ' (input is hidden)') -AsSecureString
$taskKeyPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecureKey)
try {
    $taskApiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskKeyPtr).Trim()
    if ([string]::IsNullOrWhiteSpace($taskApiKey)) { throw 'API key cannot be empty.' }
    $taskKeyFile = Join-Path $PSScriptRoot 'mindcraft\keys.json'
    $taskKeys = @{}
    if (Test-Path -LiteralPath $taskKeyFile) {
        $taskExisting = Get-Content -LiteralPath $taskKeyFile -Raw | ConvertFrom-Json
        foreach ($taskProperty in $taskExisting.PSObject.Properties) {
            $taskKeys[$taskProperty.Name] = $taskProperty.Value
        }
    }
    $taskKeys[$taskKeyName] = $taskApiKey
    [IO.File]::WriteAllText($taskKeyFile, ($taskKeys | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
    Write-Host 'Saved locally. The key is not displayed and keys.json is ignored by Git.'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskKeyPtr)
    $taskApiKey = $null
    $taskSecureKey.Dispose()
}
