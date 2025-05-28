package handlers

import (
	"context"
	"strconv"
	"time"

	"meetingagent/sql"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/cloudwego/hertz/pkg/protocol/consts"
)

const dbName = "./storage/todo.db"

// 初始化数据库
func init() {
	if err := sql.InitTodoTable(dbName); err != nil {
		panic("初始化Todo数据库失败: " + err.Error())
	}
}

// TodoRequest 创建或更新待办事项的请求
type TodoRequest struct {
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	Priority    int       `json:"priority"`
	DueDate     time.Time `json:"due_date"`
	MeetingID   string    `json:"meeting_id"`
	AssignedTo  string    `json:"assigned_to"`
}

// TodoResponse 返回给客户端的待办事项信息
type TodoResponse struct {
	ID          int64     `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	Priority    int       `json:"priority"`
	DueDate     time.Time `json:"due_date"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	MeetingID   string    `json:"meeting_id"`
	AssignedTo  string    `json:"assigned_to"`
}

// TodosResponse 返回给客户端的待办事项列表
type TodosResponse struct {
	Todos []TodoResponse `json:"todos"`
}

// CreateTodo 处理创建待办事项请求
func CreateTodo(ctx context.Context, c *app.RequestContext) {
	// 解析请求体
	var req TodoRequest
	if err := c.BindAndValidate(&req); err != nil {
		c.JSON(consts.StatusBadRequest, utils.H{"error": "无效的请求参数: " + err.Error()})
		return
	}

	// 验证必填字段
	if req.Title == "" {
		c.JSON(consts.StatusBadRequest, utils.H{"error": "标题不能为空"})
		return
	}

	// 默认状态为未开始
	if req.Status == "" {
		req.Status = "未开始"
	}

	// 创建待办事项对象
	todo := &sql.Todo{
		Title:       req.Title,
		Description: req.Description,
		Status:      req.Status,
		Priority:    req.Priority,
		DueDate:     req.DueDate,
		MeetingID:   req.MeetingID,
		AssignedTo:  req.AssignedTo,
	}

	// 添加到数据库
	id, err := sql.AddTodo(dbName, todo)
	if err != nil {
		c.JSON(consts.StatusInternalServerError, utils.H{"error": "创建待办事项失败: " + err.Error()})
		return
	}

	// 返回成功响应
	c.JSON(consts.StatusOK, utils.H{
		"message": "待办事项创建成功",
		"id":      id,
	})
}

// GetTodoList 处理获取待办事项列表请求
func GetTodoList(ctx context.Context, c *app.RequestContext) {
	// 获取查询参数
	meetingID := c.Query("meeting_id")
	status := c.Query("status")
	priorityStr := c.Query("priority")

	// 初始化优先级为0，表示不按优先级筛选
	var priority int = 0

	// 只有当priorityStr非空时才尝试转换为整数
	if priorityStr != "" {
		var err error
		priority, err = strconv.Atoi(priorityStr)
		if err != nil {
			c.JSON(consts.StatusBadRequest, utils.H{"error": "优先级参数无效"})
			return
		}
	}

	// 查询待办事项
	// 当status为空字符串且priority为0时，ListTodos会返回所有指定meeting_id的待办事项
	todos, err := sql.ListTodos(dbName, meetingID, status, priority)
	if err != nil {
		c.JSON(consts.StatusInternalServerError, utils.H{"error": "查询待办事项失败: " + err.Error()})
		return
	}

	// 转换为响应格式
	var response TodosResponse
	for _, todo := range todos {
		response.Todos = append(response.Todos, TodoResponse{
			ID:          todo.ID,
			Title:       todo.Title,
			Description: todo.Description,
			Status:      todo.Status,
			Priority:    todo.Priority,
			DueDate:     todo.DueDate,
			CreatedAt:   todo.CreatedAt,
			UpdatedAt:   todo.UpdatedAt,
			MeetingID:   todo.MeetingID,
			AssignedTo:  todo.AssignedTo,
		})
	}

	// 返回响应
	c.JSON(consts.StatusOK, response)
}

// UpdateTodo 处理更新待办事项请求
func UpdateTodo(ctx context.Context, c *app.RequestContext) {
	// 获取待办事项ID
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(consts.StatusBadRequest, utils.H{"error": "无效的ID参数"})
		return
	}

	// 查询待办事项是否存在
	todo, err := sql.GetTodoByID(dbName, id)
	if err != nil {
		c.JSON(consts.StatusNotFound, utils.H{"error": "待办事项不存在: " + err.Error()})
		return
	}

	// 解析请求体
	var req TodoRequest
	if err := c.BindAndValidate(&req); err != nil {
		c.JSON(consts.StatusBadRequest, utils.H{"error": "无效的请求参数: " + err.Error()})
		return
	}

	// 更新待办事项字段
	if req.Title != "" {
		todo.Title = req.Title
	}
	if req.Description != "" {
		todo.Description = req.Description
	}
	if req.Status != "" {
		todo.Status = req.Status
	}
	if req.Priority != 0 {
		todo.Priority = req.Priority
	}
	if !req.DueDate.IsZero() {
		todo.DueDate = req.DueDate
	}
	if req.MeetingID != "" {
		todo.MeetingID = req.MeetingID
	}
	if req.AssignedTo != "" {
		todo.AssignedTo = req.AssignedTo
	}

	// 执行更新
	if err := sql.UpdateTodo(dbName, todo); err != nil {
		c.JSON(consts.StatusInternalServerError, utils.H{"error": "更新待办事项失败: " + err.Error()})
		return
	}

	// 返回成功响应
	c.JSON(consts.StatusOK, utils.H{
		"message": "待办事项更新成功",
	})
}

// DeleteTodo 处理删除待办事项请求
func DeleteTodo(ctx context.Context, c *app.RequestContext) {
	// 获取待办事项ID
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(consts.StatusBadRequest, utils.H{"error": "无效的ID参数"})
		return
	}

	// 执行删除
	if err := sql.DeleteTodo(dbName, id); err != nil {
		c.JSON(consts.StatusInternalServerError, utils.H{"error": "删除待办事项失败: " + err.Error()})
		return
	}

	// 返回成功响应
	c.JSON(consts.StatusOK, utils.H{
		"message": "待办事项删除成功",
	})
}
