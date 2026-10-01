const fs = require('fs');
const path = require('path');

const htmlContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
    <meta charset="utf-8">
    <title>Lista de Tarefas</title>
    <style>
        body { font-family: Arial, sans-serif; }
        h2 { text-align: center; color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #000; padding: 10px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .empty-cell { width: 15%; }
    </style>
</head>
<body>
    <h2>LISTA DE TAREFAS - KANBAN (PRODUÇÃO E MANUTENÇÃO)</h2>
    <table>
        <tr>
            <th>TAREFA</th>
            <th>PROJETO / MÁQUINA</th>
            <th class="empty-cell">DATA EXECUÇÃO</th>
            <th class="empty-cell">HORA EXECUÇÃO</th>
            <th class="empty-cell">ASSINATURA</th>
        </tr>
        <tr><td colspan="5" style="background-color: #e0e0e0; font-weight: bold;">PROJETO CASA DO TREM (2652B)</td></tr>
        <tr><td>2652b - recorte ps leitoso 2</td><td>Router CNC</td><td></td><td></td><td></td></tr>
        <tr><td>2652b - gabarito letras</td><td>Router CNC</td><td></td><td></td><td></td></tr>
        <tr><td>2652b - recorte fundo pvb 10mm</td><td>Router CNC</td><td></td><td></td><td></td></tr>
        
        <tr><td colspan="5" style="background-color: #e0e0e0; font-weight: bold;">OUTROS PROJETOS NA FILA</td></tr>
        <tr><td>ISOPOR AGUIA</td><td>Router CNC</td><td></td><td></td><td></td></tr>
        <tr><td>teste parede hogwarts mdf 9mm</td><td>Router CNC</td><td></td><td></td><td></td></tr>
        <tr><td>Peças de MDF — Cliente Marcenaria X</td><td>Router CNC</td><td></td><td></td><td></td></tr>
        <tr><td>Gravação Acrílico — Loja Y</td><td>Laser</td><td></td><td></td><td></td></tr>
        <tr><td>Protótipo de Case — Interno</td><td>Impressão 3D</td><td></td><td></td><td></td></tr>

        <tr><td colspan="5" style="background-color: #e0e0e0; font-weight: bold;">ORGANIZAÇÃO E MANUTENÇÃO</td></tr>
        <tr><td>LIMPEZA NO FINAL DO DIA DA AREA DA ROUTER</td><td>Router CNC</td><td></td><td></td><td></td></tr>
        <tr><td>ORGANIZAR ARMARIO ROUTER</td><td>Router CNC</td><td></td><td></td><td></td></tr>
        <tr><td>organizar Q30 AO LADO DA ROUTER</td><td>Router CNC</td><td></td><td></td><td></td></tr>
        <tr><td>LIMPEZA E ORGANIZAÇAO DA AREA DA VACUO</td><td>Router CNC</td><td></td><td></td><td></td></tr>
        <tr><td>TIRAR POEIRA DA VACUO</td><td>Router CNC</td><td></td><td></td><td></td></tr>
    </table>
</body>
</html>
`;

const desktopPath = path.join(require('os').homedir(), 'Desktop', 'Lista_Tarefas_Kanban.doc');
fs.writeFileSync(desktopPath, htmlContent, 'utf8');
console.log('Arquivo salvo em:', desktopPath);
