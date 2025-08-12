import { describe, it, expect } from "vitest";
import type { Todo, Priority } from "types/index";
import { todoReducer } from "./todo.reducer";
import type { TodoState, TodoAction } from "./todo.reducer";

describe("todoReducer", () => {
  const initialState: TodoState = {
    todos: [],
    filter: {
      type: "all",
      sortBy: "createdAt",
      sortOrder: "desc",
    },
    loading: false,
    error: null,
  };

  const mockTodo: Todo = {
    id: "1",
    title: "Test Todo",
    description: "Test Description",
    completed: false,
    priority: "medium" as Priority,
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2023-01-01T00:00:00.000Z",
  };

  describe("ADD_TODO", () => {
    it("should add a new todo to the state", () => {
      const action: TodoAction = {
        type: "ADD_TODO",
        payload: mockTodo,
      };

      const newState = todoReducer(initialState, action);

      expect(newState.todos).toHaveLength(1);
      expect(newState.todos[0].title).toBe(mockTodo.title);
      expect(newState.todos[0].description).toBe(mockTodo.description);
      expect(newState.todos[0].completed).toBe(mockTodo.completed);
      expect(newState.todos[0].priority).toBe(mockTodo.priority);
      expect(newState.todos[0].id).toBeDefined();
      expect(newState.todos[0].createdAt).toBeDefined();
      expect(newState.todos[0].updatedAt).toBeDefined();
      expect(newState.loading).toBe(false);
      expect(newState.error).toBeNull();
    });

    it("should add multiple todos maintaining order", () => {
      const secondTodo: Todo = {
        ...mockTodo,
        id: "2",
        title: "Second Todo",
      };

      let state = todoReducer(initialState, {
        type: "ADD_TODO",
        payload: mockTodo,
      });

      state = todoReducer(state, {
        type: "ADD_TODO",
        payload: secondTodo,
      });

      expect(state.todos).toHaveLength(2);
      expect(state.todos[0].title).toBe(mockTodo.title);
      expect(state.todos[1].title).toBe(secondTodo.title);
      expect(state.todos[0].id).toBeDefined();
      expect(state.todos[1].id).toBeDefined();
    });
  });

  describe("UPDATE_TODO", () => {
    it("should update an existing todo", () => {
      const stateWithTodo: TodoState = {
        ...initialState,
        todos: [mockTodo],
      };

      const updatedTodo: Todo = {
        ...mockTodo,
        title: "Updated Todo",
        completed: true,
      };

      const action: TodoAction = {
        type: "UPDATE_TODO",
        payload: updatedTodo,
      };

      const newState = todoReducer(stateWithTodo, action);

      expect(newState.todos[0].title).toBe("Updated Todo");
      expect(newState.todos[0].completed).toBe(true);
      expect(newState.todos[0].id).toBe(mockTodo.id);
      expect(newState.todos[0].updatedAt).toBeDefined();
    });

    it("should not modify state if todo id does not exist", () => {
      const nonExistentTodo: Todo = {
        ...mockTodo,
        id: "non-existent",
      };

      const action: TodoAction = {
        type: "UPDATE_TODO",
        payload: nonExistentTodo,
      };

      const newState = todoReducer(initialState, action);

      expect(newState).toEqual(initialState);
    });
  });

  describe("DELETE_TODO", () => {
    it("should remove todo by id", () => {
      const stateWithTodos: TodoState = {
        ...initialState,
        todos: [mockTodo, { ...mockTodo, id: "2", title: "Second Todo" }],
      };

      const action: TodoAction = {
        type: "DELETE_TODO",
        payload: "1",
      };

      const newState = todoReducer(stateWithTodos, action);

      expect(newState.todos).toHaveLength(1);
      expect(newState.todos[0].id).toBe("2");
    });

    it("should not modify state if todo id does not exist", () => {
      const action: TodoAction = {
        type: "DELETE_TODO",
        payload: "non-existent",
      };

      const newState = todoReducer(initialState, action);

      expect(newState).toEqual(initialState);
    });
  });

  describe("TOGGLE_TODO", () => {
    it("should toggle completed status of a todo", () => {
      const stateWithTodo: TodoState = {
        ...initialState,
        todos: [mockTodo],
      };

      const action: TodoAction = {
        type: "TOGGLE_TODO",
        payload: "1",
      };

      const newState = todoReducer(stateWithTodo, action);

      expect(newState.todos[0].completed).toBe(true);
    });

    it("should toggle from true to false", () => {
      const completedTodo: Todo = {
        ...mockTodo,
        completed: true,
      };

      const stateWithCompletedTodo: TodoState = {
        ...initialState,
        todos: [completedTodo],
      };

      const action: TodoAction = {
        type: "TOGGLE_TODO",
        payload: "1",
      };

      const newState = todoReducer(stateWithCompletedTodo, action);

      expect(newState.todos[0].completed).toBe(false);
    });
  });

  describe("SET_LOADING", () => {
    it("should set loading state to true", () => {
      const action: TodoAction = {
        type: "SET_LOADING",
        payload: true,
      };

      const newState = todoReducer(initialState, action);

      expect(newState.loading).toBe(true);
    });

    it("should set loading state to false", () => {
      const loadingState: TodoState = {
        ...initialState,
        loading: true,
      };

      const action: TodoAction = {
        type: "SET_LOADING",
        payload: false,
      };

      const newState = todoReducer(loadingState, action);

      expect(newState.loading).toBe(false);
    });
  });

  describe("SET_ERROR", () => {
    it("should set error message", () => {
      const errorMessage = "Something went wrong";

      const action: TodoAction = {
        type: "SET_ERROR",
        payload: errorMessage,
      };

      const newState = todoReducer(initialState, action);

      expect(newState.error).toBe(errorMessage);
    });

    it("should clear error by setting null", () => {
      const errorState: TodoState = {
        ...initialState,
        error: "Previous error",
      };

      const action: TodoAction = {
        type: "SET_ERROR",
        payload: null,
      };

      const newState = todoReducer(errorState, action);

      expect(newState.error).toBeNull();
    });
  });

  describe("LOAD_TODOS", () => {
    it("should load todos and replace existing state", () => {
      const existingTodos: Todo[] = [mockTodo];
      const newTodos: Todo[] = [
        { ...mockTodo, id: "2", title: "New Todo 1" },
        { ...mockTodo, id: "3", title: "New Todo 2" },
      ];

      const stateWithExistingTodos: TodoState = {
        ...initialState,
        todos: existingTodos,
      };

      const action: TodoAction = {
        type: "LOAD_TODOS",
        payload: newTodos,
      };

      const newState = todoReducer(stateWithExistingTodos, action);

      expect(newState.todos).toEqual(newTodos);
      expect(newState.todos).toHaveLength(2);
    });

    it("should handle empty todos array", () => {
      const stateWithTodos: TodoState = {
        ...initialState,
        todos: [mockTodo],
      };

      const action: TodoAction = {
        type: "LOAD_TODOS",
        payload: [],
      };

      const newState = todoReducer(stateWithTodos, action);

      expect(newState.todos).toEqual([]);
      expect(newState.todos).toHaveLength(0);
    });
  });

  describe("CLEAR_TODOS", () => {
    it("should clear all todos", () => {
      const stateWithTodos: TodoState = {
        ...initialState,
        todos: [mockTodo, { ...mockTodo, id: "2" }],
      };

      const action: TodoAction = {
        type: "CLEAR_TODOS",
      };

      const newState = todoReducer(stateWithTodos, action);

      expect(newState.todos).toEqual([]);
      expect(newState.todos).toHaveLength(0);
    });
  });

  describe("default case", () => {
    it("should return current state for unknown action", () => {
      const unknownAction = {
        type: "UNKNOWN_ACTION",
        payload: "test",
      } as never;

      const newState = todoReducer(initialState, unknownAction);

      expect(newState).toEqual(initialState);
    });
  });
});
