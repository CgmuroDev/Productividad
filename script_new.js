// Clase para manejar el gestor de tareas
class TaskManager {
    constructor() {
        this.tasks = this.loadTasks();
        this.currentTaskDetail = null;
        this.activeTaskId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderTasks();
    }

    setupEventListeners() {
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

            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideNewTaskModal();
                }
            });
        }

        // Crear tarea
        const createTaskBtn = document.getElementById('createTaskBtn');
        if (createTaskBtn) {
            createTaskBtn.addEventListener('click', () => {
                this.createTask();
            });
        }

        // Enter para crear tarea
        const taskTitle = document.getElementById('taskTitle');
        if (taskTitle) {
            taskTitle.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.createTask();
                }
            });
        }

        // Modal de detalles de tarea
        const taskDetailModal = document.getElementById('taskDetailModal');
        if (taskDetailModal) {
            const closeTaskDetail = document.getElementById('closeTaskDetail');
            if (closeTaskDetail) {
                closeTaskDetail.addEventListener('click', () => {
                    this.hideTaskDetailModal();
                });
            }

            window.addEventListener('click', (e) => {
                if (e.target === taskDetailModal) {
                    this.hideTaskDetailModal();
                }
            });
        }

        // Botones del modal de detalles
        const addNoteBtn = document.getElementById('addNoteBtn');
        const addImageBtn = document.getElementById('addImageBtn');
        const exportTaskBtn = document.getElementById('exportTaskBtn');

        if (addNoteBtn) {
            addNoteBtn.addEventListener('click', () => {
                if (this.currentTaskDetail) {
                    this.addTextContent(this.currentTaskDetail.id);
                    this.showTaskDetail(this.currentTaskDetail.id);
                }
            });
        }

        if (addImageBtn) {
            addImageBtn.addEventListener('click', () => {
                if (this.currentTaskDetail) {
                    this.addImageFromFile(this.currentTaskDetail.id);
                }
            });
        }

        if (exportTaskBtn) {
            exportTaskBtn.addEventListener('click', () => {
                if (this.currentTaskDetail) {
                    this.exportSingleTask(this.currentTaskDetail.id);
                }
            });
        }

        // Escuchar eventos de pegado global
        document.addEventListener('paste', (e) => {
            this.handleGlobalPaste(e);
        });

        // Atajos de teclado
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.showNewTaskModal();
            }
        });

        // Drag and drop para imágenes
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const activeTask = this.getActiveTask();
                        if (activeTask) {
                            this.showImagePreview(activeTask.id, event.target.result, file.name);
                        } else {
                            this.showNotification('Por favor, selecciona una tarea donde agregar la imagen', 'warning');
                        }
                    };
                    reader.readAsDataURL(file);
                }
            }
        });
    }

    showNewTaskModal() {
        const modal = document.getElementById('newTaskModal');
        if (modal) {
            modal.style.display = 'block';
            const taskTitle = document.getElementById('taskTitle');
            if (taskTitle) {
                taskTitle.focus();
            }
        }
    }

    hideNewTaskModal() {
        const modal = document.getElementById('newTaskModal');
        const taskTitle = document.getElementById('taskTitle');
        if (modal) modal.style.display = 'none';
        if (taskTitle) taskTitle.value = '';
    }

    createTask() {
        const taskTitle = document.getElementById('taskTitle');
        if (!taskTitle) return;
        
        const title = taskTitle.value.trim();
        
        if (!title) {
            this.showNotification('Por favor, ingresa un título para la tarea', 'warning');
            return;
        }

        const task = {
            id: Date.now(),
            title: title,
            content: [],
            createdAt: new Date().toISOString()
        };

        this.tasks.push(task);
        this.saveTasks();
        this.renderTasks();
        this.hideNewTaskModal();
        this.showNotification('Tarea creada exitosamente', 'success');
    }

    deleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task && confirm(`¿Estás seguro de que quieres eliminar la tarea "${task.title}"?`)) {
            this.tasks = this.tasks.filter(task => task.id !== taskId);
            this.saveTasks();
            this.renderTasks();
            this.showNotification('Tarea eliminada', 'success');
        }
    }

    addContentToTask(taskId, type, content) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            const contentItem = {
                id: Date.now(),
                type: type,
                content: content,
                createdAt: new Date().toISOString()
            };
            task.content.push(contentItem);
            this.saveTasks();
            this.renderTasks();
            
            // Si el modal de detalles está abierto, actualizarlo
            if (this.currentTaskDetail && this.currentTaskDetail.id === taskId) {
                this.showTaskDetail(taskId);
            }
        }
    }

    deleteContentFromTask(taskId, contentId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            const contentItem = task.content.find(c => c.id === contentId);
            if (contentItem) {
                // Mostrar confirmación específica según el tipo de contenido
                let confirmMessage = '';
                if (contentItem.type === 'image') {
                    confirmMessage = '¿Estás seguro de que quieres eliminar esta imagen?';
                } else if (contentItem.type === 'text') {
                    confirmMessage = '¿Estás seguro de que quieres eliminar esta nota?';
                } else {
                    confirmMessage = '¿Estás seguro de que quieres eliminar este contenido?';
                }
                
                if (confirm(confirmMessage)) {
                    task.content = task.content.filter(c => c.id !== contentId);
                    this.saveTasks();
                    this.renderTasks();
                    
                    // Mostrar notificación de éxito
                    if (contentItem.type === 'image') {
                        this.showNotification('Imagen eliminada exitosamente', 'success');
                    } else if (contentItem.type === 'text') {
                        this.showNotification('Nota eliminada exitosamente', 'success');
                    } else {
                        this.showNotification('Contenido eliminado exitosamente', 'success');
                    }
                    
                    // Si el modal de detalles está abierto, actualizarlo
                    if (this.currentTaskDetail && this.currentTaskDetail.id === taskId) {
                        this.showTaskDetail(taskId);
                    }
                }
            }
        }
    }

    updateContentInTask(taskId, contentId, newContent) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            const contentItem = task.content.find(c => c.id === contentId);
            if (contentItem) {
                contentItem.content = newContent;
                this.saveTasks();
            }
        }
    }

    handleGlobalPaste(e) {
        const activeElement = document.activeElement;
        
        // Si estamos en un textarea, no hacer nada especial
        if (activeElement.tagName === 'TEXTAREA') {
            return;
        }

        // Verificar si hay una imagen en el clipboard
        const items = e.clipboardData.items;
        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const blob = item.getAsFile();
                this.handleImagePaste(blob);
                return;
            }
        }
    }

    handleImagePaste(blob) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;
            
            // Encontrar la tarea activa
            const activeTask = this.getActiveTask();
            if (activeTask) {
                // Mostrar preview antes de agregar
                this.showImagePreview(activeTask.id, imageData, 'Imagen pegada');
            } else {
                this.showNotification('Por favor, selecciona una tarea donde pegar la imagen', 'warning');
            }
        };
        reader.readAsDataURL(blob);
    }

    getActiveTask() {
        // Si hay una tarea activa marcada, usarla
        if (this.activeTaskId) {
            return this.tasks.find(t => t.id === this.activeTaskId);
        }
        // Si el modal de detalles está abierto, usar esa tarea
        if (this.currentTaskDetail) {
            return this.currentTaskDetail;
        }
        // Por defecto, usar la primera tarea
        return this.tasks.length > 0 ? this.tasks[0] : null;
    }

    renderTasks() {
        const container = document.getElementById('tasksContainer');
        if (!container) return;
        
        container.innerHTML = '';

        // Actualizar contador
        this.updateTaskCounter();

        if (this.tasks.length === 0) {
            container.innerHTML = `
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
            return;
        }

        this.tasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            container.appendChild(taskElement);
        });
    }

    createTaskElement(task) {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task-card task-card-clickable';
        
        const contentCount = task.content.length;
        const contentSummary = this.createContentSummary(task);
        const textPreview = this.createTextPreview(task);
        
        taskDiv.innerHTML = `
            <div class="task-header">
                <div>
                    <h3 class="task-title">${task.title}</h3>
                    <div class="task-meta">
                        <span class="task-date">📅 ${new Date(task.createdAt).toLocaleDateString('es-ES')}</span>
                        <span class="task-progress">${contentCount} elementos</span>
                    </div>
                    ${contentSummary}
                    ${textPreview}
                    ${contentCount > 0 ? '<div class="click-to-expand">👆 Clic para ver detalles completos</div>' : ''}
                </div>
                <div class="task-actions">
                    <button class="btn btn-secondary btn-small tooltip" onclick="event.stopPropagation(); taskManager.duplicateTask(${task.id})" title="Duplicar tarea">
                        <span class="btn-icon">📋</span>
                    </button>
                    <button class="btn btn-success btn-small tooltip" onclick="event.stopPropagation(); taskManager.exportSingleTask(${task.id})" title="Exportar como PDF">
                        <span class="btn-icon">📄</span>
                    </button>
                    <button class="btn btn-danger btn-small tooltip" onclick="event.stopPropagation(); taskManager.deleteTask(${task.id})" title="Eliminar tarea">
                        <span class="btn-icon">🗑️</span>
                    </button>
                </div>
            </div>
            <div class="add-content-area" onclick="event.stopPropagation(); taskManager.showTaskDetail(${task.id})">
                <p class="add-content-text">📎 Agregar contenido o ver detalles</p>
                <div class="add-content-buttons">
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); taskManager.addTextContent(${task.id}); taskManager.showTaskDetail(${task.id})">
                        <span class="btn-icon">📝</span>
                        Agregar Nota
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); taskManager.addImageFromFile(${task.id})">
                        <span class="btn-icon">🖼️</span>
                        Subir Imagen
                    </button>
                </div>
            </div>
        `;

        // Agregar evento click para abrir detalles
        taskDiv.addEventListener('click', (e) => {
            if (!e.target.closest('.task-actions') && !e.target.closest('.add-content-area')) {
                this.showTaskDetail(task.id);
            }
        });

        return taskDiv;
    }

    createContentSummary(task) {
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
        const textContents = task.content.filter(c => c.type === 'text' && c.content.trim());
        
        if (textContents.length === 0) {
            return '';
        }
        
        // Mostrar un preview del primer texto
        const firstText = textContents[0].content.trim();
        const preview = firstText.length > 80 ? firstText.substring(0, 80) + '...' : firstText;
        
        return `<div class="text-preview">${preview}</div>`;
    }

    showTaskDetail(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
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

    hideTaskDetailModal() {
        const modal = document.getElementById('taskDetailModal');
        if (modal) {
            modal.style.display = 'none';
            this.currentTaskDetail = null;
        }
    }

    renderTaskDetailContent(task) {
        if (task.content.length === 0) {
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

    viewImageFullscreen(imageSrc) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            cursor: pointer;
        `;
        
        const img = document.createElement('img');
        img.src = imageSrc;
        img.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;
        
        overlay.appendChild(img);
        document.body.appendChild(overlay);
        
        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
    }

    showImagePreview(taskId, imageData, fileName) {
        // Crear overlay para preview
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            cursor: pointer;
        `;
        
        const previewContainer = document.createElement('div');
        previewContainer.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 20px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            cursor: default;
        `;
        
        previewContainer.innerHTML = `
            <div style="text-align: center; margin-bottom: 16px;">
                <h3 style="margin: 0 0 8px 0; color: #333;">Vista previa de imagen</h3>
                <p style="margin: 0; color: #666; font-size: 14px;">${fileName}</p>
            </div>
            <div style="text-align: center; margin-bottom: 16px;">
                <img src="${imageData}" style="max-width: 100%; max-height: 300px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            </div>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="confirmImage" style="background: #34a853; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: 500;">
                    ✅ Agregar imagen
                </button>
                <button id="cancelImage" style="background: #ea4335; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: 500;">
                    ❌ Cancelar
                </button>
            </div>
        `;
        
        overlay.appendChild(previewContainer);
        document.body.appendChild(overlay);
        
        // Prevenir cierre al hacer clic en el contenedor
        previewContainer.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Confirmar imagen
        document.getElementById('confirmImage').addEventListener('click', () => {
            this.addContentToTask(taskId, 'image', imageData);
            this.showNotification('Imagen agregada exitosamente', 'success');
            document.body.removeChild(overlay);
        });
        
        // Cancelar
        document.getElementById('cancelImage').addEventListener('click', () => {
            document.body.removeChild(overlay);
            this.showNotification('Carga de imagen cancelada', 'info');
        });
        
        // Cerrar al hacer clic fuera
        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
            this.showNotification('Carga de imagen cancelada', 'info');
        });
    }

    handleTextareaKeydown(e, taskId, contentId) {
        // Actualizar contenido en tiempo real
        setTimeout(() => {
            this.updateContentInTask(taskId, contentId, e.target.value);
        }, 100);
    }

    focusTask(taskId) {
        this.activeTaskId = taskId;
    }

    addTextContent(taskId) {
        this.addContentToTask(taskId, 'text', '');
    }

    updateTaskCounter() {
        const counter = document.getElementById('taskCount');
        if (counter) {
            counter.textContent = this.tasks.length;
        }
    }

    duplicateTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            const newTask = {
                id: Date.now(),
                title: `${task.title} (Copia)`,
                content: [...task.content.map(c => ({
                    ...c,
                    id: Date.now() + Math.random()
                }))],
                createdAt: new Date().toISOString()
            };
            this.tasks.push(newTask);
            this.saveTasks();
            this.renderTasks();
            this.showNotification('Tarea duplicada exitosamente', 'success');
        }
    }

    addImageFromFile(taskId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                // Verificar el tamaño del archivo (máximo 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    this.showNotification('La imagen es demasiado grande (máximo 5MB)', 'warning');
                    return;
                }
                
                // Verificar que sea una imagen válida
                if (!file.type.startsWith('image/')) {
                    this.showNotification('Por favor selecciona un archivo de imagen válido', 'warning');
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    // Mostrar preview y opción de cancelar
                    this.showImagePreview(taskId, event.target.result, file.name);
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
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

    async generatePDF(task) {
        // Crear un elemento HTML temporal para el PDF
        const pdfContent = document.createElement('div');
        pdfContent.style.cssText = `
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        `;

        // Construir el contenido HTML
        let htmlContent = `
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #667eea; padding-bottom: 20px;">
                <h1 style="color: #667eea; margin: 0;">📋 REPORTE DE TAREA</h1>
                <h2 style="color: #333; margin: 10px 0;">${task.title}</h2>
            </div>
            
            <div style="margin-bottom: 30px; background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <p style="margin: 5px 0;"><strong>📅 Fecha:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
                <p style="margin: 5px 0;"><strong>⏰ Hora:</strong> ${new Date().toLocaleTimeString('es-ES')}</p>
                <p style="margin: 5px 0;"><strong>🗓️ Creada:</strong> ${new Date(task.createdAt).toLocaleDateString('es-ES')}</p>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h3 style="color: #667eea; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">CONTENIDO:</h3>
        `;

        if (task.content.length === 0) {
            htmlContent += '<p style="color: #666; font-style: italic;">• Sin contenido</p>';
        } else {
            for (let i = 0; i < task.content.length; i++) {
                const content = task.content[i];
                if (content.type === 'text' && content.content.trim()) {
                    htmlContent += `<div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <strong>📝 Nota:</strong><br>
                        <span style="margin-left: 20px;">${content.content.replace(/\n/g, '<br>')}</span>
                    </div>`;
                } else if (content.type === 'image') {
                    htmlContent += `<div style="margin-bottom: 15px; text-align: center;">
                        <strong>🖼️ Imagen:</strong><br>
                        <img src="${content.content}" style="max-width: 100%; height: auto; border-radius: 5px; margin-top: 10px;">
                    </div>`;
                }
            }
        }

        htmlContent += `</div>`;

        pdfContent.innerHTML = htmlContent;
        document.body.appendChild(pdfContent);

        // Verificar si html2pdf está disponible
        if (typeof html2pdf !== 'undefined') {
            const opt = {
                margin: 1,
                filename: `tarea_${task.title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };

            html2pdf().set(opt).from(pdfContent).save().then(() => {
                document.body.removeChild(pdfContent);
                this.showNotification(`PDF generado: ${opt.filename}`, 'success');
            }).catch(error => {
                document.body.removeChild(pdfContent);
                this.showNotification('Error al generar PDF', 'error');
            });
        } else {
            document.body.removeChild(pdfContent);
            this.showNotification('html2pdf no está disponible', 'error');
        }
    }

    exportAllTasks() {
        if (this.tasks.length === 0) {
            alert('No hay tareas para exportar');
            return;
        }

        let exportText = '📋 REPORTE DE TAREAS\n';
        exportText += '==================\n\n';
        exportText += `Fecha: ${new Date().toLocaleDateString('es-ES')}\n`;
        exportText += `Hora: ${new Date().toLocaleTimeString('es-ES')}\n\n`;

        this.tasks.forEach((task, index) => {
            exportText += `${index + 1}. ${task.title.toUpperCase()}\n`;
            exportText += '─'.repeat(task.title.length + 3) + '\n';
            exportText += `Creada: ${new Date(task.createdAt).toLocaleDateString('es-ES')}\n\n`;

            if (task.content.length === 0) {
                exportText += '• Sin contenido\n';
            } else {
                task.content.forEach((content, idx) => {
                    if (content.type === 'text' && content.content.trim()) {
                        exportText += `📝 Nota ${idx + 1}: ${content.content}\n`;
                    } else if (content.type === 'image') {
                        exportText += `🖼️ Imagen ${idx + 1}: [Imagen incluida]\n`;
                    }
                });
            }
            exportText += '\n';
        });

        exportText += '==================\n';
        exportText += `Total de tareas: ${this.tasks.length}\n`;

        this.downloadTextFile(exportText, 'reporte_tareas_completo.txt');
    }

    exportSingleTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        this.generatePDF(task);
    }

    downloadTextFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.showExportMessage(filename);
    }

    showExportMessage(filename) {
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #48bb78;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1001;
            font-weight: 600;
        `;
        message.innerHTML = `✅ PDF exportado: "${filename}"<br><small>📱 Listo para enviar por Telegram</small>`;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            document.body.removeChild(message);
        }, 4000);
    }

    saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(this.tasks));
    }

    loadTasks() {
        const saved = localStorage.getItem('tasks');
        return saved ? JSON.parse(saved) : [];
    }
}

// Inicializar la aplicación
let taskManager;
document.addEventListener('DOMContentLoaded', () => {
    taskManager = new TaskManager();
    console.log('TaskManager inicializado correctamente');
});
