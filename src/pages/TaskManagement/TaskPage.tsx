import React, { useState } from 'react';

interface Task {
  id: number;
  title: string;
  completed: boolean;
  dueDate: string;
}

const TaskPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [editId, setEditId] = useState<number | null>(null);

  const handleAddOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !dueDate) return;

    if (editId) {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === editId ? { ...task, title, dueDate } : task
        )
      );
      setEditId(null);
    } else {
      const newTask: Task = {
        id: Date.now(),
        title,
        completed: false,
        dueDate,
      };
      setTasks([newTask, ...tasks]);
    }

    setTitle('');
    setDueDate('');
  };

  const handleDelete = (id: number) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const handleEdit = (task: Task) => {
    setTitle(task.title);
    setDueDate(task.dueDate);
    setEditId(task.id);
  };

  const toggleComplete = (id: number) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'completed') return task.completed;
    if (filter === 'pending') return !task.completed;
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto p-6 mt-10 bg-white dark:bg-boxdark border border-stroke dark:border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Task Management</h2>

      {/* Task Form */}
      <form onSubmit={handleAddOrUpdate} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task Title"
          className="input input-bordered w-full"
          required
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="input input-bordered w-full"
          required
        />
        <button
          type="submit"
          className="bg-primary text-white rounded px-4 py-2 hover:bg-primary-dark"
        >
          {editId ? 'Update' : 'Add Task'}
        </button>
      </form>

      {/* Filter Buttons */}
      <div className="flex gap-4 mb-4">
        {(['all', 'pending', 'completed'] as const).map((f) => (
          <button
            key={f}
            className={`px-4 py-1 rounded border ${
              filter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
            }`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Task List */}
      <ul className="space-y-4">
        {filteredTasks.length === 0 && (
          <li className="text-gray-500 text-center">No tasks to show.</li>
        )}
        {filteredTasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center justify-between bg-gray-50 dark:bg-meta-4 p-4 rounded shadow-sm"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleComplete(task.id)}
                className="form-checkbox h-5 w-5 text-primary"
              />
              <div>
                <p
                  className={`font-medium ${
                    task.completed ? 'line-through text-gray-400' : 'text-gray-800 dark:text-white'
                  }`}
                >
                  {task.title}
                </p>
                <p className="text-xs text-gray-500">Due: {task.dueDate}</p>
              </div>
            </div>
            <div className="flex gap-2 text-sm">
              <button
                onClick={() => handleEdit(task)}
                className="text-blue-600 hover:underline"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(task.id)}
                className="text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TaskPage;
