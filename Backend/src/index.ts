// src/index.ts (CÓDIGO COMPLETO E FINAL - COM POSTGRESQL E RENDER)

import * as dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import multer = require('multer');
// REMOVIDO: import sqlite3 = require('sqlite3');
import { Pool } from 'pg'; // ADICIONADO: Biblioteca para PostgreSQL
import fs = require('fs');
import path = require('path');
import cors = require('cors');
import bcrypt = require('bcrypt');
import jwt = require('jsonwebtoken');
import { body, validationResult } from 'express-validator';

const app = express();
const PORT = process.env.PORT || 4000;

// === CONFIGURAÇÃO DO MULTER (sem alterações) ===
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (req: Request, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req: Request, file, cb) => {
        const uniqueName = Date.now() + "-" + file.originalname;
        cb(null, uniqueName);
    }
});
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo não permitido! Apenas imagens e PDFs são aceitos.'));
    }
};
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

// === MIDDLEWARES (sem alterações) ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors()); // Simplificado para permitir todas as origens

// === SERVIR ARQUIVOS ESTÁTICOS DO FRONTEND (sem alterações) ===
const frontendPath = path.resolve(__dirname, '../../Frontend');
app.use(express.static(frontendPath));
app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});


// === CONFIGURAÇÃO DO BANCO DE DADOS (ALTERADO) ===
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Necessário para conexões com Neon/Render
    }
});

pool.connect((err, client, release) => {
    if (err) {
        return console.error('Erro ao adquirir cliente do pool', err.stack);
    }
    console.log('Conectado ao banco de dados PostgreSQL com sucesso!');
    client.release();
});


// === MIDDLEWARE DE AUTENTICAÇÃO (sem alterações) ===
interface UsuarioPayload {
    id: number;
    role: string;
    email: string;
}
declare module 'express-serve-static-core' {
    interface Request {
        usuario?: UsuarioPayload;
    }
}
const verificarToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) { return res.status(401).json({ error: "Acesso negado. Nenhum token fornecido." }); }
    const secret = process.env.JWT_SECRET;
    if (!secret) { return res.status(500).json({ error: "Chave secreta do JWT não configurada." }); }
    jwt.verify(token, secret, (err, decoded) => {
        if (err) { return res.status(403).json({ error: "Token inválido ou expirado." }); }
        req.usuario = decoded as UsuarioPayload;
        next();
    });
};

// === MIDDLEWARE DE AUTORIZAÇÃO (sem alterações) ===
const MASTER_ADMIN_EMAIL = process.env.MASTER_ADMIN_EMAIL || 'givanildo.jose@kikos.com.br';
const verificarMasterAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario) {
        return res.status(401).json({ error: "Acesso negado. Usuário não autenticado." });
    }
    if (req.usuario.role !== 'admin') {
        return res.status(403).json({ error: "Acesso negado. Somente administradores podem realizar esta ação." });
    }
    if (req.usuario.email !== MASTER_ADMIN_EMAIL) {
        return res.status(403).json({ error: "Acesso negado. Este usuário administrador não é o administrador principal para criar novos usuários." });
    }
    next();
};

// === CRIAÇÃO DAS TABELAS (ALTERADO) ===
const criarTabelas = async () => {
    const queryUsuarios = `
    CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        role TEXT DEFAULT 'colaborador',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`;

    const queryUploads = `
    CREATE TABLE IF NOT EXISTS uploads (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
        nf TEXT NOT NULL,
        data_entrega DATE,
        nome_arquivo TEXT NOT NULL,
        data_envio TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`;

    try {
        await pool.query(queryUsuarios);
        console.log("Tabela 'usuarios' garantida.");
        await pool.query(queryUploads);
        console.log("Tabela 'uploads' garantida.");
    } catch (err) {
        console.error('Erro ao criar tabelas:', err);
    }
};

criarTabelas(); // Executa a criação das tabelas na inicialização

// === ROTA CADASTRO (ALTERADO) ===
app.post(
    "/cadastrar",
    verificarToken,
    verificarMasterAdmin,
    [
        body('nome').trim().notEmpty().withMessage('O nome é obrigatório.'),
        body('email').isEmail().withMessage('Por favor, insira um email válido.').normalizeEmail(),
        body('senha').isLength({ min: 8 }).withMessage('A senha deve ter no mínimo 8 caracteres.'),
        body('role').isIn(['transportador', 'colaborador', 'admin']).withMessage('O tipo de usuário é inválido.')
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { nome, email, senha, role } = req.body;
        const saltRounds = 10;
        try {
            const senhaHash = await bcrypt.hash(senha, saltRounds);
            const result = await pool.query(
                "INSERT INTO usuarios (nome, email, senha, role) VALUES ($1, $2, $3, $4) RETURNING id",
                [nome, email, senhaHash, role]
            );
            res.status(201).json({ msg: "Usuário cadastrado com sucesso!", id: result.rows[0].id, role: role });
        } catch (err: any) {
            console.error("Erro no cadastro:", err.message);
            if (err.code === '23505') { // Código de erro para violação de UNIQUE no PostgreSQL
                return res.status(400).json({ error: "Email já está cadastrado" });
            }
            return res.status(500).json({ error: "Ocorreu um erro ao cadastrar o usuário." });
        }
    }
);

// === ROTA LOGIN (ALTERADO) ===
app.post("/login", async (req: Request, res: Response) => {
    const { email, senha } = req.body;
    if (!email || !senha) { return res.status(400).json({ error: "Email e senha são obrigatórios." }); }

    try {
        const result = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
        const row = result.rows[0];

        if (!row) { return res.status(401).json({ error: "Credenciais inválidas." }); }

        const senhaCorreta = await bcrypt.compare(senha, row.senha);
        if (!senhaCorreta) { return res.status(401).json({ error: "Credenciais inválidas." }); }

        const secret = process.env.JWT_SECRET;
        if (!secret) { return res.status(500).json({ error: "Chave JWT não configurada." }); }

        const token = jwt.sign({ id: row.id, role: row.role, email: row.email }, secret, { expiresIn: '8h' });

        res.status(200).json({
            msg: "Login realizado com sucesso!",
            token: token,
            role: row.role,
            userName: row.nome,
            userId: row.id,
            userEmail: row.email
        });
    } catch (err: any) {
        console.error("Erro no login (DB):", err.message);
        return res.status(500).json({ error: "Ocorreu um erro ao tentar fazer o login." });
    }
});


// === ROTA UPLOAD (ALTERADO) ===
app.post(
    "/upload",
    verificarToken,
    upload.single("arquivo"),
    [
        body('nf').trim().notEmpty().withMessage('O número da NF é obrigatório.'),
        body('data_entrega').optional({ nullable: true, checkFalsy: true }).isISO8601().toDate().withMessage('A data de entrega deve estar no formato AAAA-MM-DD.')
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if (req.file) { fs.unlinkSync(req.file.path); }
            return res.status(400).json({ errors: errors.array() });
        }

        const usuario_id = req.usuario!.id;
        const { nf, data_entrega } = req.body;
        const nome_arquivo = req.file?.filename;
        if (!nome_arquivo) {
            return res.status(400).json({ error: "Nenhum arquivo enviado." });
        }

        try {
            const result = await pool.query(
                "INSERT INTO uploads (nome_arquivo, usuario_id, nf, data_entrega) VALUES ($1, $2, $3, $4) RETURNING id",
                [nome_arquivo, usuario_id, nf, data_entrega ? data_entrega : null]
            );
            res.status(201).json({ msg: "Upload realizado com sucesso!", arquivo: nome_arquivo, id: result.rows[0].id });
        } catch (err: any) {
            console.error("Erro no upload (DB):", err.message);
            return res.status(500).json({ error: "Ocorreu um erro ao salvar as informações do arquivo." });
        }
    }
);

// Rota para LISTAR UPLOADS (ALTERADO)
app.get('/uploads', verificarToken, async (req: Request, res: Response) => {
    const usuario_id_logado = req.usuario!.id;
    const usuario_role_logado = req.usuario!.role;
    const { nf, data_entrega, usuario_id, page = '1', limit = '30' } = req.query;

    let paramIndex = 1;
    let baseSql = `
        SELECT
            u.id, u.nf, u.data_entrega, u.nome_arquivo, u.data_envio,
            us.nome as usuario_nome, us.id as usuario_id_upload
        FROM uploads u
        JOIN usuarios us ON u.usuario_id = us.id
        WHERE 1=1
    `;
    const params: (string | number | null)[] = [];

    if (usuario_role_logado === 'transportador') {
        baseSql += ` AND u.usuario_id = $${paramIndex++}`;
        params.push(usuario_id_logado);
    }
    else if ((usuario_role_logado === 'colaborador' || usuario_role_logado === 'admin') && usuario_id) {
        baseSql += ` AND u.usuario_id = $${paramIndex++}`;
        params.push(Number(usuario_id));
    }

    if (nf) {
        baseSql += ` AND u.nf ILIKE $${paramIndex++}`; // ILIKE é a versão case-insensitive do LIKE no Postgres
        params.push(`%${nf}%`);
    }
    if (data_entrega) {
        baseSql += ` AND u.data_entrega = $${paramIndex++}`;
        params.push(String(data_entrega));
    }
    
    try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM (${baseSql}) AS count_query`, params);
        const totalItems = parseInt(countResult.rows[0].count);

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const offset = (pageNum - 1) * limitNum;

        const dataSql = `${baseSql} ORDER BY u.data_envio DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limitNum, offset);

        const dataResult = await pool.query(dataSql, params);
        
        res.json({ uploads: dataResult.rows, totalItems });

    } catch (err: any) {
        console.error('Erro ao listar uploads:', err.message);
        return res.status(500).json({ error: 'Erro ao buscar canhotos.' });
    }
});


// === LISTAR USUÁRIOS (ALTERADO) ===
app.get("/usuarios", verificarToken, async (req: Request, res: Response) => {
    if (req.usuario!.role !== 'colaborador' && req.usuario!.role !== 'admin') {
        return res.status(403).json({ error: "Acesso negado." });
    }
    try {
        const result = await pool.query("SELECT id, nome, email, role FROM usuarios");
        res.json(result.rows);
    } catch (err: any) {
        console.error("Erro ao listar usuários (DB):", err.message);
        return res.status(500).json({ error: "Ocorreu um erro ao buscar os dados." });
    }
});

// === ARQUIVOS ESTÁTICOS DE UPLOAD (sem alterações) ===
app.use('/uploads', express.static(uploadDir));

// Fallback para SPAs (sem alterações)
app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// === MIDDLEWARE DE ERROS (sem alterações) ===
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('ERRO NÃO TRATADO:', err.message, err.stack);
    if (err.message.includes('Tipo de arquivo não permitido')) { return res.status(400).json({ error: err.message }); }
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') { return res.status(400).json({ error: 'Arquivo muito grande. Máximo 5MB.' }); }
    }
    res.status(500).json({ error: 'Ocorreu um erro inesperado no servidor.' });
});

// === INICIAR SERVIDOR (sem alterações) ===
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});