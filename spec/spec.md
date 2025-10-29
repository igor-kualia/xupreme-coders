 # 💰 Budgeting App

A personal finance and budgeting application to help users track income, expenses, and stay within budget. Built for individuals or families looking to improve their financial awareness and habits.

---

## 📌 Project Goals

- Track income and expenses  
- Set and manage monthly category-based budgets  
- Visualize spending patterns over time  
- Notify users when approaching budget limits  
- Provide exportable summaries and reports  

---

## ✅ Core Features

- 🔐 User authentication (OAuth login)
- 🧾 Add/Edit/Delete income and expense transactions
- 🗂️ Categorize transactions (e.g., Food, Rent, Entertainment)
- 🗓️ Recurring transactions (e.g., rent, subscriptions)
- 💰 Set monthly budgets per category
- 📊 Dashboard overview (net balance, budget usage)
- 📉 Basic reports and charts (weekly, monthly)
- 🔗 Bank account syncing via [Plaid](https://plaid.com/)
- 🤖 Predictive insights using basic AI/ML models

---

## 🧪 Tech Stack

| Layer      | Technology                         |
|------------|------------------------------------|
| Frontend   | Angular                            |
| Backend    | Convex                             |
| Auth       | OAuth (Google / GitHub)            |
| Hosting    | Vercel / AWS                       |
| Bank Sync  | Plaid API                          |

---

## 🎨 UI Screens

- 🔐 Login / Sign Up  
- [Screenshot](stitch_login_sign_up/login_/_sign_up/screen.png)
- 🧾 Transaction List & Add/Edit Form
- [Screenshot](stitch_login_sign_up/transaction_list_&_add/edit_form/screen.png)
- 📊 Dashboard (budgets, totals, net income)  
- 🗂️ Category management
- [Screenshot](stitch_login_sign_up/category_management/screen.png)
- 🗓️ Budget & Recurring setup
- [Screenshot](stitch_login_sign_up/budget_&_recurring_setup/screen.png)
- 📅 Reports view (monthly, weekly)
- [Screenshot](stitch_login_sign_up/reports_view/screen.png)
- 💬 Conversational UI *(Planned)* — a chatbot interface to answer "How much did I spend on food last month?"
- [Screenshot](stitch_login_sign_up/conversational_ui/screen.png)
- 📈 AI Insights *(Planned)* — trend detection, forecasting, budgeting tips  
- ⚙️ Settings

---

## 🏗️ Development Milestones

1. 🧱 Set up project structure and environment  
2. 🔐 Implement user authentication (OAuth)
3. 📥 CRUD for transactions and categories  
4. 🧮 Budget tracking & recurring logic  
5. 📊 Build dashboard UI with charts  
6. 🧪 QA and user testing  
7. 🚀 Launch MVP  

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/)
- [Angular CLI](https://angular.io/cli)
- PostgreSQL database
- Plaid sandbox account (for testing)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/igor-kualia/xupreme-coders
cd xupreme-coders

# 2. Install frontend dependencies
npm install

# 3. Run the Angular app
ng serve
