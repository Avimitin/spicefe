#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter()]
    [ValidateRange(1, 65535)]
    [int]$Port = 45000,

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$Root = $PSScriptRoot,

    [Parameter()]
    [switch]$NoBrowser
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$script:RootPath = [System.IO.Path]::GetFullPath($Root).TrimEnd([char[]]@('\', '/'))
$script:RootPrefix = $script:RootPath + [System.IO.Path]::DirectorySeparatorChar
$script:CommonHeaders = @(
    'Cache-Control: no-cache'
    'Referrer-Policy: no-referrer'
    "Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' http: ws:; img-src 'self' data: http:; media-src 'self' blob: http:; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    'X-Content-Type-Options: nosniff'
    'X-Frame-Options: DENY'
)
$script:MimeTypes = @{
    '.css'         = 'text/css; charset=utf-8'
    '.gif'         = 'image/gif'
    '.htm'         = 'text/html; charset=utf-8'
    '.html'        = 'text/html; charset=utf-8'
    '.ico'         = 'image/x-icon'
    '.jpeg'        = 'image/jpeg'
    '.jpg'         = 'image/jpeg'
    '.js'          = 'text/javascript; charset=utf-8'
    '.json'        = 'application/json; charset=utf-8'
    '.md'          = 'text/markdown; charset=utf-8'
    '.mjs'         = 'text/javascript; charset=utf-8'
    '.png'         = 'image/png'
    '.svg'         = 'image/svg+xml'
    '.txt'         = 'text/plain; charset=utf-8'
    '.webmanifest' = 'application/manifest+json; charset=utf-8'
}

function Write-HttpHeaders {
    param(
        [Parameter(Mandatory)] [System.IO.Stream]$Stream,
        [Parameter(Mandatory)] [int]$StatusCode,
        [Parameter(Mandatory)] [string]$Reason,
        [Parameter(Mandatory)] [long]$ContentLength,
        [Parameter(Mandatory)] [string]$ContentType,
        [string[]]$ExtraHeaders = @()
    )

    $length = $ContentLength.ToString([System.Globalization.CultureInfo]::InvariantCulture)
    $lines = @(
        "HTTP/1.1 $StatusCode $Reason"
        "Content-Type: $ContentType"
        "Content-Length: $length"
        'Connection: close'
    ) + $script:CommonHeaders + $ExtraHeaders + @('', '')
    $bytes = [System.Text.Encoding]::ASCII.GetBytes([string]::Join("`r`n", $lines))
    $Stream.Write($bytes, 0, $bytes.Length)
}

function Send-TextResponse {
    param(
        [Parameter(Mandatory)] [System.IO.Stream]$Stream,
        [Parameter(Mandatory)] [int]$StatusCode,
        [Parameter(Mandatory)] [string]$Reason,
        [Parameter(Mandatory)] [string]$Body,
        [bool]$HeadOnly = $false,
        [string[]]$ExtraHeaders = @()
    )

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
    Write-HttpHeaders -Stream $Stream -StatusCode $StatusCode -Reason $Reason `
        -ContentLength $bytes.Length -ContentType 'text/plain; charset=utf-8' `
        -ExtraHeaders $ExtraHeaders
    if (-not $HeadOnly) {
        $Stream.Write($bytes, 0, $bytes.Length)
    }
}

function Get-SafeFilePath {
    param([Parameter(Mandatory)] [string]$RequestTarget)

    $pathOnly = ($RequestTarget -split '\?', 2)[0]
    try {
        $decoded = [System.Uri]::UnescapeDataString($pathOnly)
        $relative = $decoded.Replace(
            [char]'/',
            [System.IO.Path]::DirectorySeparatorChar
        ).TrimStart([char[]]@('\', '/'))
        if ([string]::IsNullOrWhiteSpace($relative)) {
            $relative = 'index.html'
        }
        $candidate = [System.IO.Path]::GetFullPath(
            [System.IO.Path]::Combine($script:RootPath, $relative)
        )
    } catch {
        return $null
    }

    $isRoot = [string]::Equals(
        $candidate,
        $script:RootPath,
        [System.StringComparison]::OrdinalIgnoreCase
    )
    if (-not $isRoot -and -not $candidate.StartsWith(
        $script:RootPrefix,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        return $null
    }

    if ([System.IO.Directory]::Exists($candidate)) {
        $candidate = [System.IO.Path]::Combine($candidate, 'index.html')
    }
    if ([System.IO.File]::Exists($candidate)) {
        return $candidate
    }
    return $null
}

if (-not [System.IO.File]::Exists([System.IO.Path]::Combine($script:RootPath, 'index.html'))) {
    Write-Error "No index.html was found in $($script:RootPath)"
    exit 1
}

$listener = $null
try {
    $listener = [System.Net.Sockets.TcpListener]::new(
        [System.Net.IPAddress]::Any,
        $Port
    )
    $listener.Start(64)

    Write-Host ''
    Write-Host 'spicefe is available on this PC:' -ForegroundColor Green
    Write-Host "Serving files from: $($script:RootPath)"
    Write-Host "  http://127.0.0.1:$Port/"
    $addresses = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
        Where-Object {
            $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
            -not [System.Net.IPAddress]::IsLoopback($_)
        }
    foreach ($address in $addresses) {
        Write-Host "  http://$($address.IPAddressToString):$Port/" -ForegroundColor Cyan
    }
    Write-Host ''
    Write-Host 'Open one of the cyan LAN addresses on your phone or tablet.'
    Write-Host 'If Windows Firewall asks, allow access on Private networks only.'
    Write-Host 'Keep this window open. Press Ctrl+C to stop the server.'
    Write-Host ''

    if (-not $NoBrowser) {
        try {
            Start-Process "http://127.0.0.1:$Port/"
        } catch {
            Write-Warning 'The local browser could not be opened automatically.'
        }
    }

    while ($true) {
        if (-not $listener.Pending()) {
            Start-Sleep -Milliseconds 100
            continue
        }
        $client = $listener.AcceptTcpClient()
        $stream = $null
        $reader = $null
        $responseStarted = $false
        try {
            $client.NoDelay = $true
            $client.ReceiveTimeout = 5000
            $client.SendTimeout = 10000
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new(
                $stream,
                [System.Text.Encoding]::ASCII,
                $false,
                4096,
                $true
            )

            $requestLine = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($requestLine)) {
                continue
            }

            $headersComplete = $false
            for ($headerCount = 0; $headerCount -lt 100; $headerCount += 1) {
                $headerLine = $reader.ReadLine()
                if ($null -eq $headerLine) {
                    break
                }
                if ($headerLine.Length -eq 0) {
                    $headersComplete = $true
                    break
                }
                if ($headerLine.Length -gt 8192) {
                    break
                }
            }

            $parts = $requestLine.Split(' ')
            if (-not $headersComplete -or $parts.Length -lt 3) {
                $responseStarted = $true
                Send-TextResponse -Stream $stream -StatusCode 400 -Reason 'Bad Request' `
                    -Body "Bad Request`n"
                continue
            }

            $method = $parts[0].ToUpperInvariant()
            $headOnly = $method -eq 'HEAD'
            if ($method -ne 'GET' -and -not $headOnly) {
                $responseStarted = $true
                Send-TextResponse -Stream $stream -StatusCode 405 -Reason 'Method Not Allowed' `
                    -Body "Method Not Allowed`n" -HeadOnly $headOnly `
                    -ExtraHeaders @('Allow: GET, HEAD')
                continue
            }

            $filePath = Get-SafeFilePath -RequestTarget $parts[1]
            if ($null -eq $filePath) {
                $responseStarted = $true
                Send-TextResponse -Stream $stream -StatusCode 404 -Reason 'Not Found' `
                    -Body "Not Found`n" -HeadOnly $headOnly
                Write-Host "$method $($parts[1]) -> 404"
                continue
            }

            $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
            $contentType = $script:MimeTypes[$extension]
            if ([string]::IsNullOrEmpty($contentType)) {
                $contentType = 'application/octet-stream'
            }
            $fileInfo = [System.IO.FileInfo]::new($filePath)
            $responseStarted = $true
            Write-HttpHeaders -Stream $stream -StatusCode 200 -Reason 'OK' `
                -ContentLength $fileInfo.Length -ContentType $contentType
            if (-not $headOnly) {
                $file = [System.IO.File]::OpenRead($filePath)
                try {
                    $file.CopyTo($stream)
                } finally {
                    $file.Dispose()
                }
            }
            Write-Host "$method $($parts[1]) -> 200"
        } catch {
            Write-Warning $_.Exception.Message
            if ($null -ne $stream -and -not $responseStarted) {
                try {
                    Send-TextResponse -Stream $stream -StatusCode 500 `
                        -Reason 'Internal Server Error' -Body "Internal Server Error`n"
                } catch {
                    # The client may already have disconnected.
                }
            }
        } finally {
            if ($null -ne $reader) {
                $reader.Dispose()
            }
            if ($null -ne $stream) {
                $stream.Dispose()
            }
            $client.Close()
        }
    }
} catch [System.Net.Sockets.SocketException] {
    Write-Error "Could not listen on port $Port. Another program may already use it. $($_.Exception.Message)"
    exit 1
} finally {
    if ($null -ne $listener) {
        $listener.Stop()
    }
}
