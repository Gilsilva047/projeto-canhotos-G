import * as dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import multer = require('multer');
import { Pool } from 'pg';
import fs = require('fs');
import path = require('path');
import cors = require('cors');
import bcrypt = require('bcrypt');
import jwt = require('jsonwebtoken');
import { body, validationResult } from 'express-validator';

const app = express();
const PORT = process.env.PORT || 4000;

// === MIDDLEWARES ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// === SERVIR ARQUIVOS ESTÁTICOS DO FRONTEND ===
const frontendPath = path.resolve(__dirname, '../../Frontend');
app.use(express.static(frontendPath));

// === CONFIGURAÇÃO DO BANCO DE DADOS ===
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// === MIDDLEWARE DE AUTENTICAÇÃO ===
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

// === MIDDLEWARE DE AUTORIZAÇÃO ===
const MASTER_ADMIN_EMAIL = process.env.MASTER_ADMIN_EMAIL || 'givanildo.jose@kikos.com.br';
const verificarMasterAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario) {
        return res.status(401).json({ error: "Acesso negado. Usuário não autenticado." });
    }
    if (req.usuario.role !== 'admin' || req.usuario.email !== MASTER_ADMIN_EMAIL) {
        return res.status(403).json({ error: "Acesso negado. Ação permitida apenas para o administrador principal." });
    }
    next();
};

// === INICIALIZAÇÃO DO BANCO DE DADOS ===
const inicializarBanco = async () => {
    const queryUsuarios = `
    CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        role TEXT DEFAULT 'colaborador',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`;

    // Garante que a tabela uploads tenha a coluna image_url e não tenha a nome_arquivo
    const queryUploads = `
    CREATE TABLE IF NOT EXISTS uploads (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
        nf TEXT NOT NULL,
        data_entrega DATE,
        image_url TEXT,
        data_envio TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`;

    const client = await pool.connect();
    try {
        await client.query(queryUsuarios);
        console.log("Tabela 'usuarios' garantida.");
        await client.query(queryUploads);
        console.log("Tabela 'uploads' garantida.");

        const res = await client.query("SELECT COUNT(*) as count FROM usuarios WHERE email = $1", [MASTER_ADMIN_EMAIL]);
        if (res.rows[0].count === '0') {
            console.log("Master Admin não encontrado, criando...");
            const initialAdminPassword = process.env.MASTER_ADMIN_INITIAL_PASSWORD || 'admin123';
            if (!MASTER_ADMIN_EMAIL || !initialAdminPassword) {
                console.error("ERRO: Variáveis de ambiente MASTER_ADMIN_EMAIL e MASTER_ADMIN_INITIAL_PASSWORD devem ser definidas.");
                return;
            }
            const hashedPassword = await bcrypt.hash(initialAdminPassword, 10);
            await client.query(
                "INSERT INTO usuarios (nome, email, senha, role) VALUES ($1, $2, $3, $4)",
                ['Master Admin', MASTER_ADMIN_EMAIL, hashedPassword, 'admin']
            );
            console.log('Usuário Master Admin criado com sucesso!');
        }
    } catch (err) {
        console.error('Erro durante a inicialização do banco de dados:', err);
    } finally {
        client.release();
    }
};

// === ROTAS ===
app.post("/cadastrar", verificarToken, verificarMasterAdmin, [
    body('nome').trim().notEmpty().withMessage('O nome é obrigatório.'),
    body('email').isEmail().withMessage('Por favor, insira um email válido.').normalizeEmail(),
    body('senha').isLength({ min: 8 }).withMessage('A senha deve ter no mínimo 8 caracteres.'),
    body('role').isIn(['transportador', 'colaborador', 'admin']).withMessage('O tipo de usuário é inválido.')
], async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { nome, email, senha, role } = req.body;
    try {
        const senhaHash = await bcrypt.hash(senha, 10);
        const result = await pool.query("INSERT INTO usuarios (nome, email, senha, role) VALUES ($1, $2, $3, $4) RETURNING id", [nome, email, senhaHash, role]);
        res.status(201).json({ msg: "Usuário cadastrado com sucesso!", id: result.rows[0].id, role: role });
    } catch (err: any) {
        if (err.code === '23505') return res.status(400).json({ error: "Email já está cadastrado" });
        return res.status(500).json({ error: "Ocorreu um erro ao cadastrar o usuário." });
    }
});

app.post("/login", async (req: Request, res: Response) => {
    const { email, senha } = req.body;
    if (!email || !senha) { return res.status(400).json({ error: "Email e senha são obrigatórios." }); }
    try {
        const result = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
        const row = result.rows[0];
        if (!row) return res.status(401).json({ error: "Credenciais inválidas." });

        const senhaCorreta = await bcrypt.compare(senha, row.senha);
        if (!senhaCorreta) return res.status(401).json({ error: "Credenciais inválidas." });

        const secret = process.env.JWT_SECRET;
        if (!secret) return res.status(500).json({ error: "Chave JWT não configurada." });

        const isMasterAdmin = row.email === MASTER_ADMIN_EMAIL && row.role === 'admin';

        const token = jwt.sign({ id: row.id, role: row.role, email: row.email }, secret, { expiresIn: '8h' });
        res.status(200).json({
            msg: "Login realizado com sucesso!",
            token,
            role: row.role,
            userName: row.nome,
            userId: row.id,
            userEmail: row.email,
            isMasterAdmin
        });
    } catch (err: any) {
        return res.status(500).json({ error: "Ocorreu um erro ao tentar fazer o login." });
    }
});

app.post("/upload", verificarToken, [
    body('nf').trim().notEmpty().withMessage('O número da NF é obrigatório.'),
    body('imageUrl').isURL().withMessage('A URL da imagem é inválida.'),
    body('data_entrega').optional({ nullable: true, checkFalsy: true }).isISO8601().toDate().withMessage('A data de entrega deve estar no formato AAAA-MM-DD.')
], async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { nf, data_entrega, imageUrl } = req.body;
    
    try {
        await pool.query(
            "INSERT INTO uploads (usuario_id, nf, data_entrega, image_url) VALUES ($1, $2, $3, $4)",
            [req.usuario!.id, nf, data_entrega ? data_entrega : null, imageUrl]
        );
        res.status(201).json({ msg: "Upload realizado com sucesso!" });
    } catch (err: any) {
        console.error("Erro ao salvar no banco:", err);
        return res.status(500).json({ error: "Ocorreu um erro ao salvar as informações." });
    }
});

app.get('/uploads', verificarToken, async (req: Request, res: Response) => {
    const { nf, data_entrega, usuario_id, page = '1', limit = '30' } = req.query;
    let paramIndex = 1;
    let baseSql = `SELECT u.id, u.nf, u.data_entrega, u.image_url, u.data_envio, us.nome as usuario_nome FROM uploads u JOIN usuarios us ON u.usuario_id = us.id`;
    let whereClauses = [];
    const params: (string | number | null)[] = [];

    if (req.usuario!.role === 'transportador') {
        whereClauses.push(`u.usuario_id = $${paramIndex++}`);
        params.push(req.usuario!.id);
    } else if ((req.usuario!.role === 'colaborador' || req.usuario!.role === 'admin') && usuario_id) {
        whereClauses.push(`u.usuario_id = $${paramIndex++}`);
        params.push(Number(usuario_id));
    }
    if (nf) {
        whereClauses.push(`u.nf ILIKE $${paramIndex++}`);
        params.push(`%${nf}%`);
    }
    if (data_entrega) {
        whereClauses.push(`u.data_entrega = $${paramIndex++}`);
        params.push(String(data_entrega));
    }

    if (whereClauses.length > 0) {
        baseSql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    
    try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM (${baseSql}) AS count_query`, params);
        const totalItems = parseInt(countResult.rows[0].count);
        const pageNum = parseInt(page as string), limitNum = parseInt(limit as string);
        const offset = (pageNum - 1) * limitNum;

        const dataParams = [...params];
        const dataSql = `${baseSql} ORDER BY u.data_envio DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        dataParams.push(limitNum, offset);

        const dataResult = await pool.query(dataSql, dataParams);
        res.json({ uploads: dataResult.rows, totalItems });
    } catch (err: any) {
        return res.status(500).json({ error: 'Erro ao buscar canhotos.' });
    }
});

app.get("/usuarios", verificarToken, async (req: Request, res: Response) => {
    if (req.usuario!.role !== 'colaborador' && req.usuario!.role !== 'admin') {
        return res.status(403).json({ error: "Acesso negado." });
    }
    try {
        const result = await pool.query("SELECT id, nome, email, role FROM usuarios ORDER BY nome ASC");
        res.json(result.rows);
    } catch (err: any) {
        return res.status(500).json({ error: "Ocorreu um erro ao buscar os dados." });
    }
});


app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// === MIDDLEWARE DE ERROS ===
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('ERRO NÃO TRATADO:', err);
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Arquivo muito grande. Máximo 5MB.' });
    }
    if (err.message.includes('Tipo de arquivo não permitido')) {
        return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Ocorreu um erro inesperado no servidor.' });
});

// === INICIAR SERVIDOR ===
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    inicializarBanco().catch(console.error);
});