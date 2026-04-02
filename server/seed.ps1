$ErrorActionPreference = "Stop"

try {
    # Fetch existing jobs and delete them to reset the DB state
    $jobs = Invoke-RestMethod -Uri "http://localhost:3000/api/jobs" -Method Get
    foreach ($j in $jobs) {
        Invoke-RestMethod -Uri "http://localhost:3000/api/jobs/$($j.id)" -Method Delete
    }
} catch {
    Write-Host "No open jobs or server not running?"
}

# The objects to add in chronological order
$data = @(
    @{ name="tabuleiro_xadrez.tap"; folder="..\arquivos 2024\jogos"; start="2026-03-25T14:00:00-03:00"; end="2026-03-25T17:00:00-03:00" },
    @{ name="relogio_parede.tap"; folder="..\arquivos 2024\relogios"; start="2026-03-25T10:00:00-03:00"; end="2026-03-25T11:30:00-03:00" },
    @{ name="porta_cozinha_v2.tap"; folder="..\arquivos 2024\cozinha"; start="2026-03-26T13:30:00-03:00"; end="2026-03-26T16:00:00-03:00" },
    @{ name="caixa_presente.tap"; folder="..\arquivos 2024\caixas"; start="2026-03-26T09:00:00-03:00"; end="2026-03-26T12:00:00-03:00" },
    @{ name="logo_empresa.tap"; folder="..\arquivos 2024\logos"; start="2026-03-27T14:00:00-03:00"; end="2026-03-27T14:30:00-03:00" },
    @{ name="mesa_de_centro.tap"; folder="..\arquivos 2024\moveis"; start="2026-03-27T08:00:00-03:00"; end="2026-03-27T10:00:00-03:00" },
    @{ name="placa_decorativa.tap"; folder="..\arquivos 2024\placas"; start="2026-03-28T13:00:00-03:00"; end="2026-03-28T15:30:00-03:00" },
    @{ name="medalha_personalizada.tap"; folder="..\arquivos 2024\medalhas"; start="2026-03-28T09:00:00-03:00"; end="2026-03-28T09:45:00-03:00" },
    @{ name="porta_cozinha_v2.tap"; folder="..\arquivos 2024\cozinha"; start="2026-03-29T10:30:00-03:00"; end="2026-03-29T11:45:00-03:00" },
    @{ name="mesa_de_centro.tap"; folder="..\arquivos 2024\moveis"; start="2026-03-29T08:30:00-03:00"; end="2026-03-29T10:15:00-03:00" }
)

foreach ($item in $data) {
    # 1. Post to start
    $startBody = @{
        file_name = $item.name
        folder = $item.folder
        file_path = "$($item.folder)\$($item.name)"
        start_time = $item.start
    } | ConvertTo-Json
    
    Invoke-RestMethod -Uri "http://localhost:3000/api/jobs" -Method Post -Body $startBody -ContentType "application/json"
    
    # 2. Patch to end
    $endBody = @{
        end_time = $item.end
    } | ConvertTo-Json
    
    Invoke-RestMethod -Uri "http://localhost:3000/api/jobs/latest" -Method Patch -Body $endBody -ContentType "application/json"
}

Write-Host "Seed completed successfully via API!"
