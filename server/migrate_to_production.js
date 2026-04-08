/**
 * Script de Migração: tracker.json → Railway Production
 * 
 * Este script:
 * 1. Registra/loga a conta casadotrem@gmail.com na produção
 * 2. Migra todos os jobs e materiais do tracker.json para o banco remoto
 * 
 * Uso: node migrate_to_production.js
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://mach3-tracker-production.up.railway.app';
const EMAIL = 'casadotrem@gmail.com';
const PASSWORD = '123456';

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  MIGRAÇÃO: tracker.json → Railway');
  console.log('═══════════════════════════════════════\n');

  // 1. Load tracker.json
  const trackerPath = path.join(__dirname, 'tracker.json');
  if (!fs.existsSync(trackerPath)) {
    console.error('❌ tracker.json não encontrado!');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(trackerPath, 'utf-8'));
  console.log(`📦 Dados carregados: ${data.jobs?.length || 0} jobs, ${data.materials?.length || 0} materiais\n`);

  // 2. Tentar login, se falhar registrar
  let token = null;
  
  console.log(`🔑 Tentando login com ${EMAIL}...`);
  let resp = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  let result = await resp.json();
  
  if (result.success && result.token) {
    token = result.token;
    console.log('✅ Login realizado!\n');
  } else {
    console.log(`⚠️ Login falhou: ${result.error}. Tentando registrar...`);
    resp = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    result = await resp.json();
    
    if (result.success || result.error?.includes('já cadastrado')) {
      // Login novamente
      resp = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
      });
      result = await resp.json();
      if (result.token) {
        token = result.token;
        console.log('✅ Conta criada e login realizado!\n');
      }
    }
  }

  if (!token) {
    console.error('❌ Não consegui autenticar. Verifique email/senha.');
    process.exit(1);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 3. Migrar materiais
  console.log('📋 Migrando materiais...');
  const materialMap = {}; // old_id -> new_id
  for (const mat of (data.materials || [])) {
    try {
      resp = await fetch(`${BASE_URL}/api/materials`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: mat.name, price: mat.price })
      });
      result = await resp.json();
      if (result.success && result.material) {
        materialMap[mat.id] = result.material.id;
        console.log(`  ✅ ${mat.name} (R$ ${mat.price}) → ID ${result.material.id}`);
      } else {
        console.log(`  ⚠️ ${mat.name}: ${result.error || 'erro'}`);
      }
    } catch (e) {
      console.log(`  ❌ ${mat.name}: ${e.message}`);
    }
  }
  console.log('');

  // 4. Migrar jobs (em ordem cronológica)
  console.log('🔧 Migrando jobs...');
  const sortedJobs = [...(data.jobs || [])].sort((a, b) => 
    new Date(a.start_time) - new Date(b.start_time)
  );
  
  let migrated = 0;
  let errors = 0;
  
  for (const job of sortedJobs) {
    try {
      // POST start
      resp = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          file_name: job.file_name,
          folder: job.folder,
          file_path: job.file_path,
          start_time: job.start_time
        })
      });
      const startResult = await resp.json();
      
      if (!startResult.success || startResult.debounced) {
        console.log(`  ⚠️ Job #${job.id} "${job.file_name}" ignorado (debounce/falha)`);
        continue;
      }
      
      const newJobId = startResult.id;
      
      // PATCH end
      if (job.end_time) {
        await fetch(`${BASE_URL}/api/jobs/latest`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ end_time: job.end_time })
        });
      }

      // PATCH material if any
      if (job.material_id && job.material_name) {
        const newMatId = materialMap[job.material_id] || job.material_id;
        await fetch(`${BASE_URL}/api/jobs/${newJobId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            material_id: newMatId,
            material_name: job.material_name,
            material_price: job.material_price || 0
          })
        });
      }
      
      migrated++;
      if (migrated % 5 === 0) console.log(`  📊 ${migrated}/${sortedJobs.length} jobs migrados...`);
      
      // Small delay to avoid debounce
      await new Promise(r => setTimeout(r, 200));
      
    } catch (e) {
      errors++;
      console.log(`  ❌ Job #${job.id}: ${e.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`  ✅ MIGRAÇÃO COMPLETA`);
  console.log(`  Jobs: ${migrated} migrados, ${errors} erros`);
  console.log(`  Materiais: ${Object.keys(materialMap).length} migrados`);
  console.log('═══════════════════════════════════════\n');
  
  // 5. Update monitor config  
  const configPath = path.join(__dirname, '..', 'monitor', 'config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    config.email = EMAIL;
    config.password = PASSWORD;
    config.token = token;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
    console.log('🔧 config.json do monitor atualizado com novo token!\n');
  }
}

main().catch(e => {
  console.error('❌ Erro fatal:', e);
  process.exit(1);
});
