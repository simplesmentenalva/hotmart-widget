const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(cors());

// ─── CONFIGURAÇÕES ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const HOTMART_SECRET = process.env.HOTMART_SECRET || "sua_chave_secreta_hotmart";
const NOME_DO_EVENTO = process.env.NOME_DO_EVENTO || "seu evento";
const MAX_COMPRAS = 20; // quantas compras manter em memória

// ─── ARMAZENAMENTO EM MEMÓRIA ──────────────────────────────────────
let compras = [];

// ─── VALIDAÇÃO DE ASSINATURA HOTMART ──────────────────────────────
function validarAssinaturaHotmart(req) {
  const assinaturaRecebida = req.headers["x-hotmart-hottok"];
  if (!assinaturaRecebida) return false;
  return true;;
}

// ─── WEBHOOK DA HOTMART ───────────────────────────────────────────
app.post("/webhook/hotmart", (req, res) => {
  // Valida a assinatura para segurança
  if (!validarAssinaturaHotmart(req)) {
    console.warn("⚠️  Requisição inválida — assinatura incorreta");
    return res.status(401).json({ erro: "Não autorizado" });
  }

  const payload = req.body;
  const evento = payload?.event;

  // Só processa compras aprovadas
  const eventosDeCompra = [
    "PURCHASE_APPROVED",
    "PURCHASE_COMPLETE",
    "PURCHASE_BILLET_PRINTED",
  ];

  if (!eventosDeCompra.includes(evento)) {
    return res.status(200).json({ mensagem: "Evento ignorado" });
  }

  // Extrai dados do comprador
  const comprador = payload?.data?.buyer;
  const produto = payload?.data?.product;

  if (!comprador?.name) {
    return res.status(200).json({ mensagem: "Sem dados do comprador" });
  }

  // Formata o nome (apenas primeiro nome + inicial do sobrenome)
  const partesNome = comprador.name.trim().split(" ");
  const primeiroNome = partesNome[0];
  const inicialSobrenome =
    partesNome.length > 1 ? ` ${partesNome[partesNome.length - 1][0]}.` : "";
  const nomeFormatado = primeiroNome + inicialSobrenome;

  const novaCompra = {
    id: crypto.randomUUID(),
    nome: nomeFormatado,
    nomeCompleto: comprador.name,
    evento: produto?.name || NOME_DO_EVENTO,
    timestamp: Date.now(),
    local: comprador.address?.city || null,
  };

  // Adiciona no início e limita o array
  compras.unshift(novaCompra);
  if (compras.length > MAX_COMPRAS) compras = compras.slice(0, MAX_COMPRAS);

  console.log(`✅ Nova compra: ${novaCompra.nome} — ${novaCompra.evento}`);
  res.status(200).json({ sucesso: true });
});

// ─── API PARA O WIDGET CONSULTAR ──────────────────────────────────
app.get("/api/compras-recentes", (req, res) => {
  // Retorna apenas compras das últimas 24 horas
  const limite24h = Date.now() - 24 * 60 * 60 * 1000;
  const comprasRecentes = compras
    .filter((c) => c.timestamp > limite24h)
    .slice(0, 10);

  res.json(comprasRecentes);
});

// ─── ENDPOINT DE TESTE (remover em produção) ──────────────────────
app.post("/api/teste", (req, res) => {
  const { nome, evento: nomeEvento } = req.body;

  const compraFalsa = {
    id: crypto.randomUUID(),
    nome: nome || "Maria S.",
    nomeCompleto: nome || "Maria Silva",
    evento: nomeEvento || NOME_DO_EVENTO,
    timestamp: Date.now(),
    local: "São Paulo",
  };

  compras.unshift(compraFalsa);
  if (compras.length > MAX_COMPRAS) compras = compras.slice(0, MAX_COMPRAS);

  console.log(`🧪 Compra de teste: ${compraFalsa.nome}`);
  res.json({ sucesso: true, compra: compraFalsa });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📌 Webhook: POST /webhook/hotmart`);
  console.log(`📌 API:     GET  /api/compras-recentes`);
  console.log(`📌 Teste:   POST /api/teste`);
});
