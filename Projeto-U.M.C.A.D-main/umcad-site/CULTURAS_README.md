# 🌱 Página de Informações de Culturas - U.M.C.A.D

## Descrição

A página de culturas foi criada para fornecer informações detalhadas sobre diferentes culturas agrícolas e suas condições ideais de crescimento, permitindo que os agricultores comparem essas informações com os dados coletados em tempo real pelo dispositivo U.M.C.A.D.

## Funcionalidades

### 📊 Dados Atuais do Campo
- Exibe os dados mais recentes coletados pelo Arduino
- Mostra temperatura, umidade do solo, umidade do ar, gases tóxicos, gases inflamáveis e status de chuva
- Atualização automática a cada 30 segundos

### 🌾 Informações das Culturas
A página inclui dados para 6 culturas principais:

1. **Milho** 🌽 - Região Centro-Oeste
2. **Soja** 🫘 - Região Sul  
3. **Café** ☕ - Região Sudeste
4. **Arroz** 🌾 - Região Sul
5. **Feijão** 🫘 - Região Nordeste
6. **Trigo** 🌾 - Região Sul

### 📈 Parâmetros Monitorados

Para cada cultura, são exibidos os seguintes parâmetros ideais:

- **Temperatura**: Faixa ideal e valor ótimo
- **Umidade do Solo**: Percentual ideal para crescimento
- **Umidade do Ar**: Condições atmosféricas ideais
- **Gases Tóxicos**: Níveis máximos seguros para plantas e humanos
- **Gases Inflamáveis**: Limites de segurança para prevenção de incêndios

### 🔍 Sistema de Comparação

A página compara automaticamente os dados atuais do campo com os parâmetros ideais de cada cultura, mostrando:

- **Status IDEAL** 🟢: Valores dentro da faixa recomendada
- **Status ATENÇÃO** 🟡: Valores próximos aos limites
- **Status PERIGO** 🔴: Valores fora dos parâmetros seguros

## Como Acessar

1. Faça login no sistema U.M.C.A.D
2. Acesse a página principal
3. Clique em "Culturas" no menu de navegação
4. Ou acesse diretamente `/culturas` após o login

## Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Banco de Dados**: SQLite
- **WebSocket**: Para atualizações em tempo real
- **Design**: CSS Grid, Flexbox, Gradientes

## Estrutura dos Dados

### Dados das Culturas
```javascript
{
  "cultura": {
    "nome": "Nome da Cultura",
    "emoji": "🌱",
    "regiao": "Região Geográfica",
    "parametros": {
      "temperatura": { "min": 15, "max": 25, "ideal": 20 },
      "umidadeSolo": { "min": 40, "max": 60, "ideal": 50 },
      "umidadeAr": { "min": 60, "max": 80, "ideal": 70 },
      "gasesToxicos": { "max": 10, "ideal": 5 },
      "gasesInflamaveis": { "max": 15, "ideal": 8 }
    }
  }
}
```

### Dados do Arduino
```javascript
{
  "temp": 25.5,
  "umidSolo": 65,
  "umidAr": 70,
  "gasToxico": 3,
  "gasInflamavel": 7,
  "estaChovendo": false,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Responsividade

A página é totalmente responsiva e se adapta a diferentes tamanhos de tela:
- **Desktop**: Layout em grid com 2 colunas
- **Tablet**: Layout em grid com 1 coluna
- **Mobile**: Layout vertical otimizado

## Atualizações Futuras

- Adicionar mais culturas regionais
- Implementar alertas automáticos
- Adicionar gráficos de tendências
- Integrar com APIs meteorológicas
- Sistema de recomendações personalizadas

## Contribuição

Para adicionar novas culturas ou modificar parâmetros existentes, edite o objeto `culturasData` no arquivo `culturas.html`.

## Suporte

Para dúvidas ou problemas, entre em contato com a equipe de desenvolvimento do U.M.C.A.D.
