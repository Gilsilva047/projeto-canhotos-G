// src/index.ts (CÓDIGO COMPLETO E FINAL - COM FRONTEND INTEGRADO)

import * as dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import multer = require('multer');
import sqlite3 = require('sqlite3');
import fs = require('fs');
import path = require('path');
import cors = require('cors');
import bcrypt = require('bcrypt');
import jwt = require('jsonwebtoken');
import { body, validationResult } from 'express-validator';

const app = express();
const PORT = process.env.PORT || 4000;

// === CONFIGURAÇÃO DO MULTER ===
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

// === MIDDLEWARES ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === CONFIGURAÇÃO DO CORS ===
const corsOptions = {
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
        // Permite qualquer origem em produção (Render) ou localhost
        callback(null, true);
    }
};
app.use(cors(corsOptions));

// === SERVIR ARQUIVOS ESTÁTICOS DO FRONTEND ===
const frontendPath = path.resolve(__dirname, '../Frontend');
console.log('🔍 Frontend path hardcoded to:', frontendPath);

app.use('/Frontend', express.static(frontendPath));
app.use('/assets', express.static(path.join(frontendPath, 'assets')));

// Rota para servir a página de login na raiz
app.get('/', (req: Request, res: Response) => {
    const indexPath = path.join(frontendPath, 'index.html');
    console.log('🔍 Trying to serve index.html from:', indexPath);
    res.sendFile(indexPath);
});

// === CONFIGURAÇÃO DO BANCO DE DADOS ===
const db = new sqlite3.Database("meu_banco.db", (err) => {
    if (err) {
        console.error('Erro ao conectar com o banco de dados:', err.message);
        process.exit(1);
    }
    console.log('Conectado ao banco SQLite com sucesso!');
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

// === MIDDLEWARE DE AUTORIZAÇÃO (Para admin específico) ===
// Define seu email de administrador principal AQUI. Lido de variáveis de ambiente.
// O segundo valor é um fallback para desenvolvimento se a variável não estiver definida.
const MASTER_ADMIN_EMAIL = process.env.MASTER_ADMIN_EMAIL || 'givanildo.jose@kikos.com.br'; 

const verificarMasterAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario) {
        return res.status(401).json({ error: "Acesso negado. Usuário não autenticado." });
    }

    // Primeiro, verifica se a role do usuário é 'admin'
    if (req.usuario.role !== 'admin') {
        return res.status(403).json({ error: "Acesso negado. Somente administradores podem realizar esta ação." });
    }

    // Em seguida, verifica se o email do admin logado corresponde ao MASTER_ADMIN_EMAIL
    if (req.usuario.email !== MASTER_ADMIN_EMAIL) {
        return res.status(403).json({ error: "Acesso negado. Este usuário administrador não é o administrador principal para criar novos usuários." });
    }

    next();
};

// === CRIAÇÃO DAS TABELAS ===
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        role TEXT DEFAULT 'colaborador',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Erro ao criar tabela usuarios:', err.message);
    });

    db.run(`CREATE TABLE IF NOT EXISTS uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        nf TEXT NOT NULL,
        data_entrega DATETIME,
        nome_arquivo TEXT NOT NULL,
        data_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`, (err) => {
        if (err) console.error('Erro ao criar tabela uploads:', err.message);
    });

    // Opcional: Adicionar dados de teste se o DB estiver vazio (para facilitar o teste)
    db.get("SELECT COUNT(*) as count FROM usuarios", (err, row: any) => {
        if (err) {
            console.error("Erro ao verificar usuários de teste:", err.message);
            return;
        }
        if (row.count === 0) {
            console.log("Adicionando usuários de teste...");

            // --- SEU USUÁRIO MASTER ADMIN ---
            // A senha inicial é lida de uma variável de ambiente. Use um fallback seguro para dev.
            const initialAdminPassword = process.env.MASTER_ADMIN_INITIAL_PASSWORD || 'admin123'; 
            bcrypt.hash(initialAdminPassword, 10).then(hashedPassword => { 
                db.run("INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?)",
                    ['Givanildo Jose Admin', MASTER_ADMIN_EMAIL, hashedPassword, 'admin'], function(err) {
                        if (err) console.error('Erro ao inserir admin de teste:', err.message);
                        else console.log('Usuário Admin de teste criado com as credenciais fornecidas.');
                    });
            });

            // Colaborador de teste (só para ver as permissões)
            bcrypt.hash('123456', 10).then(hashedPassword => {
                db.run("INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?)",
                    ['Colaborador Teste', 'colaborador@teste.com', hashedPassword, 'colaborador'], function(err) {
                        if (err) console.error('Erro ao inserir colaborador de teste:', err.message);
                        else {
                            console.log('Colaborador de teste criado.');
                            if (this && this.lastID) { // Verifica se this e lastID existem
                                db.run("INSERT INTO uploads (usuario_id, nf, data_entrega, nome_arquivo) VALUES (?, ?, ?, ?)",
                                    [this.lastID, 'NF2', '2023-10-20', 'nf2_colaborador.png'],
                                    (err) => { if (err) console.error('Erro ao inserir upload de teste (colaborador):', err.message); });
                                db.run("INSERT INTO uploads (usuario_id, nf, data_entrega, nome_arquivo) VALUES (?, ?, ?, ?)",
                                    [this.lastID, 'NF3', null, 'nf3_colaborador.pdf'],
                                    (err) => { if (err) console.error('Erro ao inserir upload de teste (colaborador):', err.message); });
                            }
                        }
                    });
            });

            // Transportador de teste (só para ver as permissões)
            bcrypt.hash('admin123', 10).then(hashedPassword => {
                db.run("INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?)",
                    ['Administrador Transp.', 'admin@teste.com', hashedPassword, 'transportador'], function(err) {
                        if (err) console.error('Erro ao inserir transportador de teste:', err.message);
                        else {
                            console.log('Transportador de teste criado.');
                            if (this && this.lastID) { // Verifica se this e lastID existem
                                db.run("INSERT INTO uploads (usuario_id, nf, data_entrega, nome_arquivo) VALUES (?, ?, ?, ?)",
                                    [this.lastID, 'NF1', '2023-10-26', 'nf1_transportador.png'],
                                    (err) => { if (err) console.error('Erro ao inserir upload de teste (transportador):', err.message); });
                                db.run("INSERT INTO uploads (usuario_id, nf, data_entrega, nome_arquivo) VALUES (?, ?, ?, ?)",
                                    [this.lastID, 'NF4', '2023-11-15', 'nf4_transportador.png'],
                                    (err) => { if (err) console.error('Erro ao inserir upload de teste (transportador):', err.message); });
                            }
                        }
                    });
            });
        }
    });
});

// === ROTA CADASTRO (PROTEGIDA POR TOKEN E MASTER ADMIN) ===
app.post(
    "/cadastrar",
    verificarToken,
    verificarMasterAdmin, // Agora verifica role 'admin' E se é o MASTER_ADMIN_EMAIL
    [
        body('nome').trim().notEmpty().withMessage('O nome é obrigatório.'),
        body('email').isEmail().withMessage('Por favor, insira um email válido.').normalizeEmail(),
        body('senha').isLength({ min: 8 }).withMessage('A senha deve ter no mínimo 8 caracteres.'),
        body('role').isIn(['transportador', 'colaborador', 'admin']).withMessage('O tipo de usuário é inválido.') 
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if (req.file) { fs.unlinkSync(req.file.path); } 
            return res.status(400).json({ errors: errors.array() });
        }
        const { nome, email, senha, role } = req.body;
        const saltRounds = 10;
        const senhaHash = await bcrypt.hash(senha, saltRounds);

        db.run(
            "INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?)",
            [nome, email, senhaHash, role],
            function (err) {
                if (err) {
                    console.error("Erro no cadastro:", err.message);
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: "Email já está cadastrado" });
                    }
                    return res.status(500).json({ error: "Ocorreu um erro ao cadastrar o usuário." });
                }
                res.status(201).json({ msg: "Usuário cadastrado com sucesso!", id: this.lastID, role: role });
            }
        );
    }
);

// === ROTA LOGIN ===
app.post("/login", (req: Request, res: Response) => {
    const { email, senha } = req.body;
    if (!email || !senha) { return res.status(400).json({ error: "Email e senha são obrigatórios." }); }

    db.get("SELECT * FROM usuarios WHERE email = ?", [email], async (err, row: any) => {
        if (err) {
            console.error("Erro no login (DB):", err.message);
            return res.status(500).json({ error: "Ocorreu um erro ao tentar fazer o login." });
        }
        if (!row) { return res.status(401).json({ error: "Credenciais inválidas." }); }

        const senhaCorreta = await bcrypt.compare(senha, row.senha);
        if (!senhaCorreta) { return res.status(401).json({ error: "Credenciais inválidas." }); }

        const secret = process.env.JWT_SECRET;
        if (!secret) { return res.status(500).json({ error: "Chave secreta do JWT não configurada." }); }

        const token = jwt.sign({ id: row.id, role: row.role, email: row.email }, secret, { expiresIn: '8h' });

        res.status(200).json({
            msg: "Login realizado com sucesso!",
            token: token,
            role: row.role,
            userName: row.nome,
            userId: row.id,
            userEmail: row.email 
        });
    });
});

// Rota para LISTAR UPLOADS (protegida e com filtros/paginação)
app.get('/uploads', verificarToken, (req: Request, res: Response) => {
    const usuario_id_logado = req.usuario!.id;
    const usuario_role_logado = req.usuario!.role;

    const { nf, data_entrega, usuario_id, page = '1', limit = '30' } = req.query;

    let sql = `
        SELECT
            u.id, u.nf, u.data_entrega, u.nome_arquivo, u.data_envio,
            us.nome as usuario_nome, us.id as usuario_id_upload
        FROM uploads u
        JOIN usuarios us ON u.usuario_id = us.id
        WHERE 1=1
    `;
    const params: (string | number | null)[] = [];

    // LÓGICA DE USUÁRIOS:
    // Se o usuário logado for TRANSPORTADOR, só pode ver os próprios uploads
    if (usuario_role_logado === 'transportador') {
        sql += ` AND u.usuario_id = ?`;
        params.push(usuario_id_logado);
    }
    // Se o usuário logado for COLABORADOR ou ADMIN, ele pode ver todos ou filtrar por um usuario_id específico
    else if ((usuario_role_logado === 'colaborador' || usuario_role_logado === 'admin') && usuario_id) {
        sql += ` AND u.usuario_id = ?`;
        params.push(Number(usuario_id));
    }
    // Se for colaborador/admin e não houver usuario_id especificado, ele vê todos (nenhum AND adicional aqui)


    if (nf) {
        sql += ` AND u.nf LIKE ?`;
        params.push(`%${nf}%`);
    }
    if (data_entrega) {
        sql += ` AND STRFTIME('%Y-%m-%d', u.data_entrega) = ?`;
        params.push(String(data_entrega));
    }

    // --- Paginação ---
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const countSql = `SELECT COUNT(*) FROM (${sql}) AS count_query`;

    db.get(countSql, params, (err, countRow: any) => {
        if (err) {
            console.error('Erro ao contar uploads:', err.message);
            return res.status(500).json({ error: 'Erro ao buscar total de canhotos.' });
        }
        const totalItems = countRow['COUNT(*)'];

        sql += ` ORDER BY u.data_envio DESC LIMIT ? OFFSET ?`;
        params.push(limitNum, offset);

        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('Erro ao listar uploads:', err.message);
                return res.status(500).json({ error: 'Erro ao buscar canhotos.' });
            }
            res.json({ uploads: rows, totalItems });
        });
    });
});

// === ROTA UPLOAD (para realizar um novo upload) ===
app.post(
    "/upload",
    verificarToken,
    upload.single("arquivo"),
    [
        body('nf').trim().notEmpty().withMessage('O número da NF é obrigatório.'),
        body('data_entrega').optional({ nullable: true, checkFalsy: true }).isISO8601().toDate().withMessage('A data de entrega deve estar no formato AAAA-MM-DD.')
    ],
    (req: Request, res: Response) => {
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

        db.run(
            "INSERT INTO uploads (nome_arquivo, usuario_id, nf, data_entrega) VALUES (?, ?, ?, ?)",
            [nome_arquivo, usuario_id, nf, data_entrega ? data_entrega.toISOString().split('T')[0] : null],
            function (err) {
                if (err) {
                    console.error("Erro no upload (DB):", err.message);
                    return res.status(500).json({ error: "Ocorreu um erro ao salvar as informações do arquivo." });
                }
                res.status(201).json({ msg: "Upload realizado com sucesso!", arquivo: nome_arquivo, id: this.lastID });
            }
        );
    }
);

// === LISTAR USUÁRIOS (para o filtro de colaborador/admin) ===
app.get("/usuarios", verificarToken, (req: Request, res: Response) => {
    // Agora, apenas COLABORADORES ou ADMINS podem ter acesso a esta lista completa de usuários
    if (req.usuario!.role !== 'colaborador' && req.usuario!.role !== 'admin') {
        return res.status(403).json({ error: "Acesso negado. Apenas colaboradores ou administradores podem listar usuários para filtro." });
    }

    db.all("SELECT id, nome, email, role FROM usuarios", [], (err, rows) => {
        if (err) {
            console.error("Erro ao listar usuários (DB):", err.message);
            return res.status(500).json({ error: "Ocorreu um erro ao buscar os dados." });
        }
        res.json(rows);
    });
});

// === ARQUIVOS ESTÁTICOS ===
app.use('/uploads', express.static(uploadDir));

// Fallback para SPAs - redireciona para o frontend em rotas não encontradas
app.get('*', (req: Request, res: Response) => {
    // Ignora rotas da API para não interferir
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/login') || req.path.startsWith('/cadastrar') || req.path.startsWith('/usuarios')) {
        return res.status(404).json({ error: 'Rota não encontrada' });
    }
    // Serve o index.html para qualquer rota não API
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// === MIDDLEWARE DE ERROS ===
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('ERRO NÃO TRATADO:', err.message, err.stack);
    if (err.message.includes('Acesso negado pelo CORS')) { return res.status(403).json({ error: err.message }); }
    if (err.message.includes('Tipo de arquivo não permitido')) { return res.status(400).json({ error: err.message }); }
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') { return res.status(400).json({ error: 'Arquivo muito grande. Máximo 5MB.' }); }
    }
    if (err && (err as any).array) {
        return res.status(400).json({ errors: (err as any).array() });
    }
    res.status(500).json({ error: 'Ocorreu um erro inesperado no servidor.' });
});

// === ENCERRAR CONEXÃO COM BANCO NO CTRL+C ===
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) { console.error('Erro ao fechar banco:', err.message); }
        else { console.log('Conexão com banco fechada.'); }
        process.exit(0);
    });
});

// === INICIAR SERVIDOR ===
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Acesse o frontend em http://localhost:${PORT}`);
});