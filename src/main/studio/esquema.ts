/**
 * Esquema do banco do Studio, versionado.
 *
 * Cada item de MIGRACOES roda uma vez e fica registrado em
 * `studio_migracoes`. Para mudar o banco, **acrescente** uma migração nova
 * no fim da lista — nunca edite uma que já rodou, senão os bancos existentes
 * ficam diferentes dos novos.
 *
 * Mesmo esquema do app Tauri/Python anterior (`src-tauri/migrations/*.sql`),
 * então um `soul.db` antigo continua sendo lido sem conversão.
 */
export const MIGRACOES: { versao: number; nome: string; sql: string }[] = [
  {
    versao: 1,
    nome: "veiculos",
    sql: `
      CREATE TABLE IF NOT EXISTS veiculos (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        nome          TEXT    NOT NULL,
        ano           TEXT,
        versao        TEXT,
        cambio        TEXT,
        combustivel   TEXT,
        preco         INTEGER,
        km            INTEGER,
        placa         TEXT,
        status        TEXT    NOT NULL DEFAULT 'rascunho',
        des_md        TEXT,
        criado_em     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
        atualizado_em TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_veiculos_atualizado ON veiculos (atualizado_em DESC);
    `,
  },
  {
    versao: 2,
    nome: "ficha",
    // Ficha completa: documento (CRLV), dados técnicos, equipamentos e DES.md.
    sql: `
      ALTER TABLE veiculos ADD COLUMN marca_modelo  TEXT;
      ALTER TABLE veiculos ADD COLUMN cor           TEXT;
      ALTER TABLE veiculos ADD COLUMN renavam       TEXT;
      ALTER TABLE veiculos ADD COLUMN chassi        TEXT;
      ALTER TABLE veiculos ADD COLUMN configuracao  TEXT;
      ALTER TABLE veiculos ADD COLUMN lugares       TEXT;
      ALTER TABLE veiculos ADD COLUMN portas        TEXT;
      ALTER TABLE veiculos ADD COLUMN direcao       TEXT;
      ALTER TABLE veiculos ADD COLUMN seguranca     TEXT;
      ALTER TABLE veiculos ADD COLUMN conforto      TEXT;
      ALTER TABLE veiculos ADD COLUMN infotenimento TEXT;
      ALTER TABLE veiculos ADD COLUMN des_base      TEXT;

      CREATE TABLE IF NOT EXISTS config (
        chave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
      );

      INSERT OR IGNORE INTO config (chave, valor) VALUES
        ('contato',  '11965952083'),
        ('horario',  'Segunda a sexta, das 8h às 17h' || char(10) || 'Aos sábados, das 8h às 16h' || char(10) || 'E aos domingos, somente com horário marcado.'),
        ('loja',     'Soul Cars Veículos'),
        ('endereco', 'Av. São Miguel, 8999 - Vila Norma, São Paulo/SP');
    `,
  },
  {
    versao: 3,
    nome: "estoque",
    // Ligação do veículo com a subpasta do estoque (ex.: ESTOQUE\1177428_FORD_ECOSPORT_FCM7D90).
    sql: `
      ALTER TABLE veiculos ADD COLUMN pasta TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_veiculos_pasta ON veiculos (pasta) WHERE pasta IS NOT NULL;

      ALTER TABLE veiculos ADD COLUMN des_ia TEXT;

      CREATE TABLE IF NOT EXISTS estoque_pastas (
        caminho     TEXT PRIMARY KEY,
        situacao    TEXT NOT NULL,
        detalhe     TEXT,
        veiculo_id  INTEGER,
        atualizado  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
    `,
  },
  {
    versao: 4,
    nome: "ajustes",
    // Ajustes do editor de criativos por veículo (JSON do app-bridge.js).
    sql: `ALTER TABLE veiculos ADD COLUMN ajustes TEXT;`,
  },
  {
    versao: 5,
    nome: "relatorios",
    // Histórico dos relatórios Meta Ads (para comparar com o anterior e reabrir).
    sql: `
      CREATE TABLE IF NOT EXISTS relatorios (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo        TEXT NOT NULL,
        arquivo     TEXT NOT NULL,
        inicio      TEXT NOT NULL,
        fim         TEXT NOT NULL,
        dados       TEXT NOT NULL,
        criado_em   TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_relatorios_tipo ON relatorios (tipo, criado_em DESC);
    `,
  },
  {
    versao: 6,
    nome: "entrada",
    // Registro dos arquivos vistos na pasta sincronizada (Google Drive/OneDrive): o que já
    // foi copiado para a pasta do veículo, o que está pendente e o que deu aviso ou erro.
    sql: `
      CREATE TABLE IF NOT EXISTS entrada_arquivos (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        origem        TEXT    NOT NULL,
        tamanho       INTEGER NOT NULL,
        mtime_ms      INTEGER NOT NULL,
        situacao      TEXT    NOT NULL,
        detalhe       TEXT,
        aviso         INTEGER NOT NULL DEFAULT 0,
        destino       TEXT,
        hash          TEXT,
        veiculo_pasta TEXT,
        liberado      INTEGER NOT NULL DEFAULT 0,
        atualizado    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
        UNIQUE (origem, tamanho, mtime_ms)
      );
      CREATE INDEX IF NOT EXISTS idx_entrada_situacao ON entrada_arquivos (situacao);
    `,
  },
];
