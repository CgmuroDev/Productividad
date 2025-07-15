// Clase mejorada para manejar el gestor de tareas con SQLite
class TaskManagerPro {
    constructor() {
        this.db = null;
        this.currentTaskDetail = null;
        this.activeTaskId = null;
        this.searchTerm = '';
        this.filterStatus = 'all'; // all, active, completed
        this.sortBy = 'date'; // date, title, priority
        this.init();
    }

    async init() {
        await this.initDatabase();
        this.setupEventListeners();
        this.renderTasks();
        this.setupSearch();
    }

    async initDatabase() {
        try {
            // Usar IndexedDB para mejor compatibilidad
            this.db = await this.openIndexedDB();
            console.log('Base de datos inicializada correctamente');
        } catch (error) {
            console.error('Error al inicializar base de datos:', error);
            // Fallback a localStorage
            this.db = null;
        }
    }

    openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('TaskManagerDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Crear tabla de tareas
                if (!db.objectStoreNames.contains('tasks')) {
                    const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
                    taskStore.createIndex('title', 'title', { unique: false });
                    taskStore.createIndex('createdAt', 'createdAt', { unique: false });
                    taskStore.createIndex('status', 'status', { unique: false });
                    taskStore.createIndex('priority', 'priority', { unique: false });
                    taskStore.createIndex('category', 'category', { unique: false });
                }
                
                // Crear tabla de contenido
                if (!db.objectStoreNames.contains('content')) {
                    const contentStore = db.createObjectStore('content', { keyPath: 'id' });
                    contentStore.createIndex('taskId', 'taskId', { unique: false });
                    contentStore.createIndex('type', 'type', { unique: false });
                    contentStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                // Crear tabla de categorías
                if (!db.objectStoreNames.contains('categories')) {
                    const categoryStore = db.createObjectStore('categories', { keyPath: 'id' });
                    categoryStore.createIndex('name', 'name', { unique: true });
                }
                
                // Crear tabla de configuración
                if (!db.objectStoreNames.contains('settings')) {
                    const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    async saveTask(task) {
        if (!this.db) {
            // Fallback a localStorage
            const tasks = this.loadTasksFromStorage();
            const existingIndex = tasks.findIndex(t => t.id === task.id);
            if (existingIndex >= 0) {
                tasks[existingIndex] = task;
            } else {
                tasks.push(task);
            }
            localStorage.setItem('tasks', JSON.stringify(tasks));
            return;
        }

        try {
            const transaction = this.db.transaction(['tasks'], 'readwrite');
            const store = transaction.objectStore('tasks');
            await store.put(task);
            console.log('Tarea guardada en IndexedDB');
        } catch (error) {
            console.error('Error al guardar tarea:', error);
        }
    }

    async loadTasks() {
        if (!this.db) {
            // Fallback a localStorage
            return this.loadTasksFromStorage();
        }

        try {
            const transaction = this.db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const request = store.getAll();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error al cargar tareas:', error);
            return [];
        }
    }

    async deleteTask(taskId) {
        if (!this.db) {
            // Fallback a localStorage
            const tasks = this.loadTasksFromStorage();
            const filteredTasks = tasks.filter(t => t.id !== taskId);
            localStorage.setItem('tasks', JSON.stringify(filteredTasks));
            return;
        }

        try {
            const transaction = this.db.transaction(['tasks', 'content'], 'readwrite');
            const taskStore = transaction.objectStore('tasks');
            const contentStore = transaction.objectStore('content');
            
            // Eliminar tarea
            await taskStore.delete(taskId);
            
            // Eliminar contenido relacionado
            const contentIndex = contentStore.index('taskId');
            const contentRequest = contentIndex.getAll(taskId);
            
            contentRequest.onsuccess = async () => {
                const contents = contentRequest.result;
                for (const content of contents) {
                    await contentStore.delete(content.id);
                }
            };
            
            console.log('Tarea eliminada de IndexedDB');
        } catch (error) {
            console.error('Error al eliminar tarea:', error);
        }
    }

    async searchTasks(query, filters = {}) {
        if (!this.db) {
            // Fallback a localStorage
            const tasks = this.loadTasksFromStorage();
            return tasks.filter(task => 
                task.title.toLowerCase().includes(query.toLowerCase()) ||
                task.content.some(c => c.type === 'text' && c.content.toLowerCase().includes(query.toLowerCase()))
            );
        }

        try {
            const transaction = this.db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const request = store.getAll();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const tasks = request.result || [];
                    const filtered = tasks.filter(task => {
                        const matchesQuery = !query || 
                            task.title.toLowerCase().includes(query.toLowerCase()) ||
                            task.category?.toLowerCase().includes(query.toLowerCase());
                        
                        const matchesStatus = !filters.status || filters.status === 'all' || 
                            task.status === filters.status;
                        
                        const matchesPriority = !filters.priority || 
                            task.priority === filters.priority;
                        
                        const matchesCategory = !filters.category || 
                            task.category === filters.category;
                        
                        return matchesQuery && matchesStatus && matchesPriority && matchesCategory;
                    });
                    
                    // Ordenar resultados
                    if (filters.sortBy === 'title') {
                        filtered.sort((a, b) => a.title.localeCompare(b.title));
                    } else if (filters.sortBy === 'priority') {
                        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
                        filtered.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));
                    } else {
                        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    }
                    
                    resolve(filtered);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error en búsqueda:', error);
            return [];
        }
    }

    loadTasksFromStorage() {
        const saved = localStorage.getItem('tasks');
        return saved ? JSON.parse(saved) : [];
    }

    setupEventListeners() {
        // Eventos básicos existentes
        this.setupBasicEvents();
        
        // Nuevos eventos para funcionalidades avanzadas
        this.setupAdvancedEvents();
    }

    setupBasicEvents() {
        // Botón para nueva tarea
        const newTaskBtn = document.getElementById('newTaskBtn');
        if (newTaskBtn) {
            newTaskBtn.addEventListener('click', () => {
                this.showNewTaskModal();
            });
        }

        // Modal de nueva tarea
        const modal = document.getElementById('newTaskModal');
        if (modal) {
            const closeBtn = modal.querySelector('.close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.hideNewTaskModal();
                });
            }
        }

        // Crear tarea
        const createTaskBtn = document.getElementById('createTaskBtn');
        if (createTaskBtn) {
            createTaskBtn.addEventListener('click', () => {
                this.createTask();
            });
        }

        // Atajos de teclado
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.showNewTaskModal();
            }
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                document.getElementById('searchInput')?.focus();
            }
        });
    }

    setupAdvancedEvents() {
        // Filtros y ordenación
        const filterStatus = document.getElementById('filterStatus');
        const filterPriority = document.getElementById('filterPriority');
        const filterCategory = document.getElementById('filterCategory');
        const sortBy = document.getElementById('sortBy');

        if (filterStatus) {
            filterStatus.addEventListener('change', () => {
                this.filterStatus = filterStatus.value;
                this.renderTasks();
            });
        }

        if (filterPriority) {
            filterPriority.addEventListener('change', () => {
                this.filterPriority = filterPriority.value;
                this.renderTasks();
            });
        }

        if (sortBy) {
            sortBy.addEventListener('change', () => {
                this.sortBy = sortBy.value;
                this.renderTasks();
            });
        }

        // Botón limpiar búsqueda
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.value = '';
                    this.searchTerm = '';
                    this.renderTasks();
                }
            });
        }

        // Modal de detalles de tarea
        const taskDetailModal = document.getElementById('taskDetailModal');
        if (taskDetailModal) {
            const closeBtn = taskDetailModal.querySelector('#closeTaskDetail');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.hideTaskDetailModal();
                });
            }
        }

        // Botones del modal de detalles
        const addNoteBtn = document.getElementById('addNoteBtn');
        if (addNoteBtn) {
            addNoteBtn.addEventListener('click', () => {
                this.addNoteToTask();
            });
        }

        const addImageBtn = document.getElementById('addImageBtn');
        if (addImageBtn) {
            addImageBtn.addEventListener('click', () => {
                this.addImageToTask();
            });
        }

        const exportTaskBtn = document.getElementById('exportTaskBtn');
        if (exportTaskBtn) {
            exportTaskBtn.addEventListener('click', () => {
                if (this.currentTaskDetail) {
                    this.exportSingleTask(this.currentTaskDetail.id);
                }
            });
        }

        // Exportar datos
        const exportBtn = document.getElementById('exportAllBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportAllData();
            });
        }

        // Importar datos
        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                this.importData();
            });
        }

        // Cerrar modales con Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Cerrar cualquier modal abierto
                const openModal = document.querySelector('.modal[style*="display: block"]');
                if (openModal) {
                    openModal.style.display = 'none';
                    this.currentTaskDetail = null;
                }
            }
        });

        // Cerrar modales clickeando fuera
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
                if (e.target.id === 'taskDetailModal') {
                    this.currentTaskDetail = null;
                }
            }
        });

        // Pegar imágenes con Ctrl+V
        document.addEventListener('paste', (e) => {
            if (this.currentTaskDetail) {
                const items = e.clipboardData.items;
                for (let item of items) {
                    if (item.type.indexOf('image') !== -1) {
                        const file = item.getAsFile();
                        const reader = new FileReader();
                        reader.onload = async (e) => {
                            const imageData = e.target.result;
                            if (await this.showImagePreview(imageData)) {
                                const newImage = {
                                    id: Date.now(),
                                    type: 'image',
                                    content: imageData,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString()
                                };
                                
                                const tasks = await this.loadTasks();
                                const task = tasks.find(t => t.id === this.currentTaskDetail.id);
                                
                                if (task) {
                                    if (!task.content) task.content = [];
                                    task.content.push(newImage);
                                    task.updatedAt = new Date().toISOString();
                                    
                                    await this.saveTask(task);
                                    this.showTaskDetail(task.id);
                                    this.renderTasks();
                                    this.showNotification('Imagen agregada desde el portapapeles', 'success');
                                }
                            }
                        };
                        reader.readAsDataURL(file);
                        break;
                    }
                }
            }
        });

        // Backup automático
        setInterval(() => {
            this.createBackup();
        }, 5 * 60 * 1000); // Cada 5 minutos
    }

    setupSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchTerm = e.target.value;
                    this.renderTasks();
                }, 300);
            });
        }
    }

    async renderTasks() {
        const container = document.getElementById('tasksContainer');
        if (!container) return;

        // Mostrar loading
        container.innerHTML = '<div class="loading">Cargando tareas...</div>';

        try {
            const tasks = await this.searchTasks(this.searchTerm, {
                status: this.filterStatus,
                priority: this.filterPriority,
                category: this.filterCategory,
                sortBy: this.sortBy
            });

            this.updateTaskCounter(tasks);

            if (tasks.length === 0) {
                container.innerHTML = this.renderEmptyState();
                return;
            }

            container.innerHTML = '';
            tasks.forEach(task => {
                const taskElement = this.createTaskElement(task);
                container.appendChild(taskElement);
            });

        } catch (error) {
            console.error('Error al renderizar tareas:', error);
            container.innerHTML = '<div class="error">Error al cargar tareas</div>';
        }
    }

    createTaskElement(task) {
        const taskDiv = document.createElement('div');
        taskDiv.className = `task-card task-card-clickable ${task.status === 'completed' ? 'completed' : ''}`;
        
        // Añadir clase de prioridad
        if (task.priority) {
            taskDiv.classList.add(`priority-${task.priority}`);
        }
        
        const contentCount = task.content ? task.content.length : 0;
        const contentSummary = this.createContentSummary(task);
        const textPreview = this.createTextPreview(task);
        
        taskDiv.innerHTML = `
            <div class="task-header">
                <div class="task-status-controls">
                    <input type="checkbox" class="task-checkbox" ${task.status === 'completed' ? 'checked' : ''} 
                           onchange="taskManager.toggleTaskStatus(${task.id})" />
                    <div class="task-priority ${task.priority || 'medium'}"></div>
                </div>
                <div class="task-info">
                    <h3 class="task-title">${task.title}</h3>
                    <div class="task-meta">
                        <span class="task-date">📅 ${new Date(task.createdAt).toLocaleDateString('es-ES')}</span>
                        <span class="task-progress">${contentCount} elementos</span>
                        ${task.category ? `<span class="task-category">${task.category}</span>` : ''}
                    </div>
                    ${contentSummary}
                    ${textPreview}
                    ${contentCount > 0 ? '<div class="click-to-expand">👆 Clic para ver detalles completos</div>' : ''}
                </div>
                <div class="task-actions">
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); taskManager.editTask(${task.id})" title="Editar tarea">
                        <span class="btn-icon">✏️</span>
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); taskManager.duplicateTask(${task.id})" title="Duplicar tarea">
                        <span class="btn-icon">📋</span>
                    </button>
                    <button class="btn btn-success btn-small" onclick="event.stopPropagation(); taskManager.exportSingleTask(${task.id})" title="Exportar PDF">
                        <span class="btn-icon">📄</span>
                    </button>
                    <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); taskManager.deleteTaskConfirm(${task.id})" title="Eliminar tarea">
                        <span class="btn-icon">🗑️</span>
                    </button>
                </div>
            </div>
        `;

        // Eventos
        taskDiv.addEventListener('click', (e) => {
            if (!e.target.closest('.task-actions') && !e.target.closest('.task-status-controls')) {
                this.showTaskDetail(task.id);
            }
        });

        return taskDiv;
    }

    async createTask() {
        const title = document.getElementById('taskTitle').value.trim();
        const category = document.getElementById('taskCategory').value.trim();
        const priority = document.getElementById('taskPriority').value;
        
        if (!title) {
            this.showNotification('Por favor, ingresa un título para la tarea', 'warning');
            return;
        }

        const task = {
            id: Date.now(),
            title: title,
            category: category || 'General',
            priority: priority || 'medium',
            status: 'active',
            content: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await this.saveTask(task);
        this.renderTasks();
        this.hideNewTaskModal();
        this.showNotification('Tarea creada exitosamente', 'success');
    }

    async toggleTaskStatus(taskId) {
        const tasks = await this.loadTasks();
        const task = tasks.find(t => t.id === taskId);
        
        if (task) {
            task.status = task.status === 'completed' ? 'active' : 'completed';
            task.updatedAt = new Date().toISOString();
            await this.saveTask(task);
            this.renderTasks();
            
            const message = task.status === 'completed' ? 'Tarea completada' : 'Tarea reactivada';
            this.showNotification(message, 'success');
        }
    }

    async deleteTaskConfirm(taskId) {
        const tasks = await this.loadTasks();
        const task = tasks.find(t => t.id === taskId);
        
        if (task && confirm(`¿Estás seguro de que quieres eliminar la tarea "${task.title}"?`)) {
            await this.deleteTask(taskId);
            this.renderTasks();
            this.showNotification('Tarea eliminada', 'success');
        }
    }

    // Funciones de backup y exportación
    async createBackup() {
        try {
            const tasks = await this.loadTasks();
            const backup = {
                version: '2.0',
                timestamp: new Date().toISOString(),
                tasks: tasks,
                settings: await this.getSettings()
            };
            
            localStorage.setItem('taskManager_backup', JSON.stringify(backup));
            console.log('Backup creado automáticamente');
        } catch (error) {
            console.error('Error al crear backup:', error);
        }
    }

    async exportAllData() {
        try {
            const tasks = await this.loadTasks();
            const exportData = {
                version: '2.0',
                timestamp: new Date().toISOString(),
                tasks: tasks,
                settings: await this.getSettings()
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `tareas_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.showNotification('Datos exportados exitosamente', 'success');
        } catch (error) {
            console.error('Error al exportar datos:', error);
            this.showNotification('Error al exportar datos', 'error');
        }
    }

    async importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    
                    if (data.version && data.tasks) {
                        // Importar tareas
                        for (const task of data.tasks) {
                            await this.saveTask(task);
                        }
                        
                        this.renderTasks();
                        this.showNotification(`${data.tasks.length} tareas importadas`, 'success');
                    } else {
                        this.showNotification('Formato de archivo inválido', 'error');
                    }
                } catch (error) {
                    console.error('Error al importar:', error);
                    this.showNotification('Error al importar archivo', 'error');
                }
            }
        };
        input.click();
    }

    async getSettings() {
        // Implementar gestión de configuraciones
        return {
            theme: localStorage.getItem('theme') || 'light',
            language: localStorage.getItem('language') || 'es',
            autoBackup: localStorage.getItem('autoBackup') !== 'false'
        };
    }

    // Funciones de utilidad mejoradas
    createContentSummary(task) {
        if (!task.content) return '<div class="task-summary">Sin contenido</div>';
        
        const imageCount = task.content.filter(c => c.type === 'image').length;
        const noteCount = task.content.filter(c => c.type === 'text' && c.content.trim()).length;
        
        if (imageCount === 0 && noteCount === 0) {
            return '<div class="task-summary">Sin contenido</div>';
        }
        
        let summary = '<div class="task-summary"><div class="content-summary">';
        
        if (imageCount > 0) {
            summary += `<div class="content-indicator has-images">
                <span class="btn-icon">🖼️</span>
                ${imageCount} imagen${imageCount > 1 ? 'es' : ''}
            </div>`;
        }
        
        if (noteCount > 0) {
            summary += `<div class="content-indicator has-notes">
                <span class="btn-icon">📝</span>
                ${noteCount} nota${noteCount > 1 ? 's' : ''}
            </div>`;
        }
        
        summary += '</div></div>';
        return summary;
    }

    createTextPreview(task) {
        if (!task.content) return '';
        
        const textContents = task.content.filter(c => c.type === 'text' && c.content.trim());
        
        if (textContents.length === 0) {
            return '';
        }
        
        const firstText = textContents[0].content.trim();
        const preview = firstText.length > 80 ? firstText.substring(0, 80) + '...' : firstText;
        
        return `<div class="text-preview">${preview}</div>`;
    }

    updateTaskCounter(tasks) {
        const totalCount = tasks.length;
        const completedCount = tasks.filter(t => t.status === 'completed').length;
        const activeCount = tasks.filter(t => t.status === 'active').length;
        
        const taskCountEl = document.getElementById('taskCount');
        const completedCountEl = document.getElementById('completedCount');
        const activeCountEl = document.getElementById('activeCount');
        
        if (taskCountEl) taskCountEl.textContent = totalCount;
        if (completedCountEl) completedCountEl.textContent = completedCount;
        if (activeCountEl) activeCountEl.textContent = activeCount;
    }

    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-illustration">📝</div>
                <h3>¡Comienza tu primer proyecto!</h3>
                <p>Crea una tarea para empezar a documentar tu progreso</p>
                <button class="btn btn-primary" onclick="taskManager.showNewTaskModal()">
                    <span class="btn-icon">➕</span>
                    Crear Primera Tarea
                </button>
            </div>
        `;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 12px;
            color: white;
            font-weight: 600;
            z-index: 1002;
            transform: translateX(400px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            max-width: 350px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        `;

        const colors = {
            success: 'linear-gradient(45deg, #38a169, #2f855a)',
            error: 'linear-gradient(45deg, #e53e3e, #c53030)',
            info: 'linear-gradient(45deg, #667eea, #764ba2)',
            warning: 'linear-gradient(45deg, #ed8936, #dd6b20)'
        };

        notification.style.background = colors[type] || colors.info;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2rem;">
                    ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    showNewTaskModal() {
        const modal = document.getElementById('newTaskModal');
        if (modal) {
            modal.style.display = 'block';
            document.getElementById('taskTitle')?.focus();
        }
    }

    hideNewTaskModal() {
        const modal = document.getElementById('newTaskModal');
        if (modal) {
            modal.style.display = 'none';
            document.getElementById('taskTitle').value = '';
            document.getElementById('taskCategory').value = '';
            document.getElementById('taskPriority').value = 'medium';
        }
    }

    async showTaskDetail(taskId) {
        const tasks = await this.loadTasks();
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        
        this.currentTaskDetail = task;
        
        const modal = document.getElementById('taskDetailModal');
        const titleElement = document.getElementById('taskDetailTitle');
        const contentElement = document.getElementById('taskDetailContent');
        
        if (modal && titleElement && contentElement) {
            titleElement.textContent = `📋 ${task.title}`;
            contentElement.innerHTML = this.renderTaskDetailContent(task);
            modal.style.display = 'block';
        }
    }

    renderTaskDetailContent(task) {
        if (!task.content || task.content.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-illustration">📝</div>
                    <h3>Sin contenido</h3>
                    <p>Agrega notas o imágenes para comenzar</p>
                </div>
            `;
        }

        return task.content.map(content => {
            if (content.type === 'image') {
                return `
                    <div class="content-item image-content">
                        <div class="content-header">
                            <span class="content-type-badge">🖼️ Imagen</span>
                            <button class="delete-content-btn" onclick="taskManager.deleteContentFromTask(${task.id}, ${content.id})" title="Eliminar imagen">
                                <span class="btn-icon">🗑️</span>
                                Eliminar
                            </button>
                        </div>
                        <img src="${content.content}" alt="Imagen" onclick="taskManager.viewImageFullscreen('${content.content}')" title="Clic para ver en pantalla completa">
                    </div>
                `;
            } else if (content.type === 'text') {
                return `
                    <div class="content-item text-content">
                        <div class="content-header">
                            <span class="content-type-badge">📝 Nota</span>
                            <button class="delete-content-btn" onclick="taskManager.deleteContentFromTask(${task.id}, ${content.id})" title="Eliminar nota">
                                <span class="btn-icon">🗑️</span>
                                Eliminar
                            </button>
                        </div>
                        <textarea 
                            placeholder="Escribe aquí tus notas..."
                            onkeyup="taskManager.handleTextareaKeydown(event, ${task.id}, ${content.id})"
                            onblur="taskManager.handleTextareaKeydown(event, ${task.id}, ${content.id})"
                        >${content.content}</textarea>
                    </div>
                `;
            }
        }).join('');
    }

    hideTaskDetailModal() {
        const modal = document.getElementById('taskDetailModal');
        if (modal) {
            modal.style.display = 'none';
            this.currentTaskDetail = null;
        }
    }

    // Funcionalidades adicionales implementadas
    async duplicateTask(taskId) {
        const tasks = await this.loadTasks();
        const task = tasks.find(t => t.id === taskId);
        
        if (task) {
            const newTask = {
                ...task,
                id: Date.now(),
                title: `${task.title} (Copia)`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'active'
            };
            
            await this.saveTask(newTask);
            this.renderTasks();
            this.showNotification('Tarea duplicada exitosamente', 'success');
        }
    }

    async editTask(taskId) {
        const tasks = await this.loadTasks();
        const task = tasks.find(t => t.id === taskId);
        
        if (task) {
            // Prellenar el modal con los datos existentes
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskCategory').value = task.category || 'General';
            document.getElementById('taskPriority').value = task.priority || 'medium';
            
            // Cambiar el comportamiento del botón crear
            const createBtn = document.getElementById('createTaskBtn');
            createBtn.innerHTML = '<span class="btn-icon">💾</span> Actualizar Tarea';
            createBtn.onclick = () => this.updateExistingTask(taskId);
            
            this.showNewTaskModal();
        }
    }

    async updateExistingTask(taskId) {
        const title = document.getElementById('taskTitle').value.trim();
        const category = document.getElementById('taskCategory').value.trim();
        const priority = document.getElementById('taskPriority').value;
        
        if (!title) {
            this.showNotification('Por favor, ingresa un título para la tarea', 'warning');
            return;
        }

        const tasks = await this.loadTasks();
        const task = tasks.find(t => t.id === taskId);
        
        if (task) {
            task.title = title;
            task.category = category || 'General';
            task.priority = priority || 'medium';
            task.updatedAt = new Date().toISOString();
            
            await this.saveTask(task);
            this.renderTasks();
            this.hideNewTaskModal();
            this.showNotification('Tarea actualizada exitosamente', 'success');
            
            // Restaurar el botón crear
            const createBtn = document.getElementById('createTaskBtn');
            createBtn.innerHTML = '<span class="btn-icon">✨</span> Crear Tarea';
            createBtn.onclick = () => this.createTask();
        }
    }

    async exportSingleTask(taskId) {
        const tasks = await this.loadTasks();
        const task = tasks.find(t => t.id === taskId);
        
        if (!task) return;

        const exportContent = this.generateTaskHTML(task);
        const opt = {
            margin: 1,
            filename: `tarea_${task.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        try {
            await html2pdf().set(opt).from(exportContent).save();
            this.showNotification('PDF generado exitosamente', 'success');
        } catch (error) {
            console.error('Error al generar PDF:', error);
            this.showNotification('Error al generar PDF', 'error');
        }
    }

    generateTaskHTML(task) {
        const div = document.createElement('div');
        div.innerHTML = `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
                <div style="border-bottom: 3px solid #667eea; padding-bottom: 20px; margin-bottom: 30px;">
                    <h1 style="color: #2d3748; margin-bottom: 10px;">📋 ${task.title}</h1>
                    <div style="color: #718096; font-size: 14px;">
                        <span>📅 Creado: ${new Date(task.createdAt).toLocaleDateString('es-ES')}</span>
                        <span style="margin-left: 20px;">📊 Estado: ${task.status === 'completed' ? 'Completada' : 'Activa'}</span>
                        <span style="margin-left: 20px;">🏷️ Categoría: ${task.category}</span>
                        <span style="margin-left: 20px;">⚡ Prioridad: ${task.priority}</span>
                    </div>
                </div>
                
                <div style="margin-top: 30px;">
                    ${task.content && task.content.length > 0 ? this.generateContentHTML(task.content) : '<p style="color: #718096; text-align: center; font-style: italic;">Sin contenido adicional</p>'}
                </div>
                
                <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 12px; text-align: center;">
                    Generado con TaskManager Pro - ${new Date().toLocaleDateString('es-ES')}
                </div>
            </div>
        `;
        return div;
    }

    generateContentHTML(content) {
        return content.map(item => {
            if (item.type === 'text') {
                return `<div style="margin-bottom: 20px; padding: 15px; background: #f7fafc; border-left: 4px solid #667eea; border-radius: 6px;">
                    <h3 style="color: #2d3748; margin-bottom: 10px; font-size: 16px;">📝 Nota</h3>
                    <p style="color: #4a5568; line-height: 1.6; white-space: pre-wrap;">${item.content}</p>
                </div>`;
            } else if (item.type === 'image') {
                return `<div style="margin-bottom: 20px; text-align: center;">
                    <h3 style="color: #2d3748; margin-bottom: 10px; font-size: 16px;">🖼️ Imagen</h3>
                    <img src="${item.content}" style="max-width: 100%; border-radius: 6px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);" />
                </div>`;
            }
            return '';
        }).join('');
    }

    viewImageFullscreen(imageSrc) {
        const modal = document.getElementById('imageModal');
        const img = document.getElementById('fullscreenImage');
        const closeBtn = document.getElementById('closeImageModal');
        
        if (modal && img) {
            img.src = imageSrc;
            modal.style.display = 'block';
            
            if (closeBtn) {
                closeBtn.onclick = () => {
                    modal.style.display = 'none';
                };
            }
            
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            };
        }
    }

    async handleTextareaKeydown(e, taskId, contentId) {
        const textarea = e.target;
        const content = textarea.value;
        
        // Guardar automáticamente después de 1 segundo de inactividad
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(async () => {
            await this.updateTaskContent(taskId, contentId, content);
        }, 1000);
        
        // Guardar al presionar Ctrl+S
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            await this.updateTaskContent(taskId, contentId, content);
            this.showNotification('Contenido guardado', 'success');
        }
    }

    async updateTaskContent(taskId, contentId, newContent) {
        const tasks = await this.loadTasks();
        const task = tasks.find(t => t.id === taskId);
        
        if (task && task.content) {
            const contentItem = task.content.find(c => c.id === contentId);
            if (contentItem) {
                contentItem.content = newContent;
                contentItem.updatedAt = new Date().toISOString();
                task.updatedAt = new Date().toISOString();
                
                await this.saveTask(task);
                this.renderTasks();
            }
        }
    }

    async deleteContentFromTask(taskId, contentId) {
        const tasks = await this.loadTasks();
        const task = tasks.find(t => t.id === taskId);
        
        if (task && task.content && confirm('¿Estás seguro de que quieres eliminar este contenido?')) {
            task.content = task.content.filter(c => c.id !== contentId);
            task.updatedAt = new Date().toISOString();
            
            await this.saveTask(task);
            this.renderTasks();
            
            // Actualizar la vista del detalle si está abierta
            if (this.currentTaskDetail && this.currentTaskDetail.id === taskId) {
                this.showTaskDetail(taskId);
            }
            
            this.showNotification('Contenido eliminado', 'success');
        }
    }

    // Funciones adicionales para el modal de detalles
    async addNoteToTask() {
        if (!this.currentTaskDetail) return;
        
        const newNote = {
            id: Date.now(),
            type: 'text',
            content: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const tasks = await this.loadTasks();
        const task = tasks.find(t => t.id === this.currentTaskDetail.id);
        
        if (task) {
            if (!task.content) task.content = [];
            task.content.push(newNote);
            task.updatedAt = new Date().toISOString();
            
            await this.saveTask(task);
            this.showTaskDetail(task.id);
            this.renderTasks();
            this.showNotification('Nota agregada', 'success');
        }
    }

    async addImageToTask() {
        if (!this.currentTaskDetail) return;
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                // Mostrar preview antes de agregar
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const imageData = e.target.result;
                    
                    // Confirmar antes de agregar
                    if (await this.showImagePreview(imageData)) {
                        const newImage = {
                            id: Date.now(),
                            type: 'image',
                            content: imageData,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        
                        const tasks = await this.loadTasks();
                        const task = tasks.find(t => t.id === this.currentTaskDetail.id);
                        
                        if (task) {
                            if (!task.content) task.content = [];
                            task.content.push(newImage);
                            task.updatedAt = new Date().toISOString();
                            
                            await this.saveTask(task);
                            this.showTaskDetail(task.id);
                            this.renderTasks();
                            this.showNotification('Imagen agregada', 'success');
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    }

    async showImagePreview(imageData) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>🖼️ Vista Previa de Imagen</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <img src="${imageData}" style="max-width: 100%; border-radius: 8px;" />
                        <p style="margin-top: 1rem; color: var(--text-muted); text-align: center;">
                            ¿Quieres agregar esta imagen a la tarea?
                        </p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="cancelImage">Cancelar</button>
                        <button class="btn btn-primary" id="confirmImage">Agregar Imagen</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const closeModal = () => {
                document.body.removeChild(modal);
                resolve(false);
            };
            
            modal.querySelector('.close').onclick = closeModal;
            modal.querySelector('#cancelImage').onclick = closeModal;
            modal.querySelector('#confirmImage').onclick = () => {
                document.body.removeChild(modal);
                resolve(true);
            };
            
            modal.onclick = (e) => {
                if (e.target === modal) closeModal();
            };
        });
    }
}

// Inicializar la aplicación mejorada
let taskManager;
document.addEventListener('DOMContentLoaded', () => {
    taskManager = new TaskManagerPro();
    console.log('TaskManager Pro inicializado correctamente');
});
