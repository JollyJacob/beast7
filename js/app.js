/*global jQuery, Handlebars, Router */
jQuery(function ($) {
	'use strict';

	Handlebars.registerHelper('eq', function (a, b, options) {
		return a === b ? options.fn(this) : options.inverse(this);
	});
	Handlebars.registerHelper('calcLiPadding', function (tier, options) {
		// Used in index.html to calculate how many pixels a todo should be indented, based on its tier
		return (tier-1)*45;
	});
	Handlebars.registerHelper('isFirstTodo', function (id, options) {
		if (id === todoRoot.children[0].longId) {
			return options.fn(this);
		}
	});

	var ENTER_KEY = 13;
	var ESCAPE_KEY = 27;
	var TAB_KEY = 9;
	var UP_ARROW = 38;
	var DOWN_ARROW = 40;

	var util = {
		pluralize: function (count, word) {
			return count === 1 ? word : word + 's';
		},
		store: function (namespace, data) {
			if (arguments.length > 1) {
				return localStorage.setItem(namespace, JSON.stringify(data));
			} else {
				var store = localStorage.getItem(namespace);
				return (store && JSON.parse(store)) || [];
			}
		}
	};




	// TodoNode objects will be used to make a hierarchical tree of todos
	function TodoNode(parent, title) {
		this.parent = parent;
		this.title = title;
		this.children = [];
		this.completed = false;
		if (!parent) {
			this.localId = "todo_root";
			this.longId = "todo_root";
			this.tier = 0;
			this.rootNode = this;
		} else {
			this.localId = parent.children.length;
			// this.longId is for unique identification in the DOM
			this.longId = this.constructLongId();
			this.tier = parent.tier + 1;
			this.rootNode = parent.rootNode;
		}
	}
		TodoNode.prototype.constructLongId = function() {
			// longIds are constructed as chains of localIds joined by hyphens
			return this.parent.longId + "-" + this.localId;
		}
		// suppressUpdates is optional, default false; if true, the todo tree is not updated with its information
		// position is optional: tells where the child belongs in the order; default is at the end
		TodoNode.prototype.createChild = function(title, suppressUpdates, position) {
			var child = new TodoNode(this, title);
			this.adoptChild(child, suppressUpdates, position);
			return child;
		}
		// adoptChild and disownChild are for adding/removing a preexisting node
			// as a child to/from this node
		// suppressUpdates is optional, default false; if true, the todo tree is not updated with its information
		// position is optional: tells where the child belongs in the order; default is at the end
		TodoNode.prototype.adoptChild = function(child, suppressUpdates, position) {
			child.parent = this;
			if (position === undefined || position > this.children.length-1) {
				this.children.push(child);
			} else {
				if (position < 0) position = 0;
				this.children.splice(position, 0, child);
			}
			if (!suppressUpdates) {
				this.updateDescendents();
				this.updateCompleteness();
				this.rootNode.save();
			}
		}
		TodoNode.prototype.disownChild = function(child) {
			this.children.splice(child.localId, 1);
			this.updateDescendents();
			this.updateCompleteness();
			this.rootNode.save();
		}
		// If thisIsARecursiveCall, function will not do updateCompleteness of parent or rootNode.save
		TodoNode.prototype.setCompleteness = function(isComplete, thisIsARecursiveCall) {
			this.children.forEach(function(child) {
				child.setCompleteness(isComplete, true);
			});
			this.completed = isComplete;
			if (!thisIsARecursiveCall) {
				if (this.parent) this.parent.updateCompleteness();
				this.rootNode.save();
			}
		}
		// Should only be called from within other TodoNode.prototype methods
		TodoNode.prototype.updateCompleteness = function() {
			// allComplete will hold true if all children true,
			//   false if at least one child false
			// If no children, completeness of this todo does not change.
			var allComplete = null;
			if (this.children.length > 0) {
				allComplete = true;
				for (var i = 0; i < this.children.length; i++) {
					if (!this.children[i].completed) {
						allComplete = false;
						break;
					}
				}
			}
			
			if (allComplete !== null && allComplete !== this.completed) {
				this.completed = allComplete;
				// Changing the completeness of this todo might ripple to the parent
				if (this.parent) this.parent.updateCompleteness();
			}
		}
		TodoNode.prototype.setTitle = function(newTitle) {
			this.title = newTitle;
			this.rootNode.save();
		}
		TodoNode.prototype.destroy = function() {
			// Rely on "reachability" garbage collection to get rid of all the descendents of this node
			this.parent.disownChild(this);
		}
		// If thisIsARecursiveCall, function will not do updateDecendentIds or rootNode.save
		TodoNode.prototype.destroyCompletedDescendents = function(thisIsARecursiveCall) {
			// Rely on "reachability" garbage collection to get rid of all the descendents of destroyd children
			this.children = this.children.filter(function(child) {
				return !child.completed;
			});
			this.children.forEach(function(child) {
				child.destroyCompletedDescendents(true);
			});
			if (!thisIsARecursiveCall) {
				this.updateDescendents();
				this.rootNode.save();
			}
		}
		// Makes sure all descendents' ids and tiers are up-to-date
		// Should only be called from within other TodoNode.prototype methods
		TodoNode.prototype.updateDescendents = function() {
			for (var i = 0; i < this.children.length; i++) {
				this.children[i].localId = i;
				this.children[i].longId = this.children[i].constructLongId();
				this.children[i].tier = this.tier + 1;
				this.children[i].updateDescendents();
			}
		}
		TodoNode.prototype.isDescendentOf = function(possibleAncestor) {
			var node = this;
			while (node.parent !== null) {
				if (node.parent === possibleAncestor) return true;
				node = node.parent;
			}
			return false;
		}
		// getNodeAbove and getNodeBelow return the node above/below this one in the flat array of the todo tree
		TodoNode.prototype.getNodeAbove = function() {
			// Return youngest descendent of immediately-older sibling
			// If it has no descendents, return immediately-older sibling
			// If none exists, return parent
			if (this.localId > 0) {
				// Immediately-older sibling exists
				var olderSibling = this.parent.children[this.localId-1];
				var toReturn = olderSibling;
				while (toReturn.children.length > 0) {
					toReturn = toReturn.children[toReturn.children.length-1];
				}
				return toReturn;
			} else {
				// Immediately-older sibling does not exist
				return this.parent;
			}
		}
		TodoNode.prototype.getNodeBelow = function() {
			if (this.children.length > 0) {
				return this.children[0];
			}
			var node = this;
			// Recusive logic: Do I have any younger siblings?
			//    If not, ask the same question from my parent's perspective.
			while (node.parent !== null) {
				if (node.parent.children.length-1 > node.localId) {
					return node.parent.children[node.localId + 1];
				}
				node = node.parent;
			}
			return null;
		}
		TodoNode.prototype.indent = function() {
			if (this.localId > 0) {
				// This is not an only child, so its immediately-older sibling can become its parent
				this.parent.disownChild(this);
				this.parent.children[this.localId-1].adoptChild(this);
			}
		}
		TodoNode.prototype.unindent = function() {
			if (this.tier >= 2) {
				// This node's grandparent will adopt it
				this.parent.disownChild(this);
				this.parent.parent.adoptChild(this, false, this.parent.localId + 1)
			}
		}
		// Returns a 1D (flat) array presenting all nodes in the tree in depth-first order
		// Optional addToThisArray: if included, flat array will append to it
		// Instead of using references to the actual node objects, new anononymous objects
			// are created and used, containing only some of the properties of the node objects.
			// This is to avoid circular references, allowing this data to be passed to JSON.stringify.
		TodoNode.prototype.getSimplifiedArrayOfDescendents = function(addToThisArray) {
			if (addToThisArray === undefined) addToThisArray = [];
			this.children.forEach(function(child) {
				addToThisArray.push({
					title: child.title,
					longId: child.longId,
					tier: child.tier,
					completed: child.completed
				});
				child.getSimplifiedArrayOfDescendents(addToThisArray);
			});
			return addToThisArray;
		}
	// End definition of TodoNode.prototype methods


	// todoRoot is the root node for the tree of todos
	// This object will contain some general utility methods for the todo tree
	var todoRoot = new TodoNode(null, "root");
		todoRoot.save = function() {
			util.store('todos-jquery-nested', this.getSimplifiedArrayOfDescendents());
		}
		todoRoot.load = function() {
			var todoArray = util.store('todos-jquery-nested');
			if (!todoArray) return;
			var arrayIndex = 0;
			// This IIFE assumes that the data was stored using this.getSimplifiedArrayOfDescendents
			// The array is marched through, in flat top-to-bottom order
			(function createDescendents(node) {
				while (arrayIndex < todoArray.length && todoArray[arrayIndex].tier === node.tier + 1) {
					var child = node.createChild(todoArray[arrayIndex].title, true);
					child.completed = todoArray[arrayIndex].completed;
					arrayIndex++;
					createDescendents(child);
				}
			})(this);
		}
		todoRoot.getTodo = function(longId) {
			var addressArray = longId.split("-");
			var node = this;
			for (var i = 1; i < addressArray.length; i++) {
				node = node.children[addressArray[i]];
			}
			return node;
		}



	// The App object is in charge of managing the DOM and initializing the app
	var App = {
		init: function () {
			todoRoot.load();
			this.todoTemplate = Handlebars.compile($('#todo-template').html());
			this.footerTemplate = Handlebars.compile($('#footer-template').html());
			this.bindEvents();

			new Router({
				'/:filter': function (filter) {
					this.filter = filter;
					this.render();
				}.bind(this)
			}).init('/all');

			this.render();
		},

		// Used to prevent focusout events during this.render
		suppressFocusOutEvent: false,
		// Records which todo node is focused on
		todoInFocus: null,

		bindEvents: function () {
			$('#footer').on('mousedown', '#filter-all', (function() {
				window.location.hash = "all";
				// Other handling of this event will be done by focusout event and the Router
			}).bind(this));
			$('#footer').on('mousedown', '#filter-active', (function() {
				window.location.hash = "active";
				// Other handling of this event will be done by focusout event and the Router
			}).bind(this));
			$('#footer').on('mousedown', '#filter-completed', (function() {
				window.location.hash = "completed";
				// Other handling of this event will be done by focusout event and the Router
			}).bind(this));
			$('#footer').on('mousedown', '#clear-completed', (function() {
					this.updateTodoInFocus(false);
					// Re-focus on the nearest older node that will not be destroyed
					var node = this.todoInFocus;
					if (node !== null) {
						while (node.completed) {
							node = node.getNodeAbove();
							if (node === todoRoot) break;
						}
					}
					todoRoot.destroyCompletedDescendents();
					window.location.hash = "all";
					this.render(node);
				}).bind(this));
			

			$('#todo-list')
				.on('mousedown', '.toggle', (function(e) {
						// User clicked the checkbox next to a todo
						this.updateTodoInFocus(false);
						// Toggle the checked-ness of the todo
						var liDomId = $(e.target).closest('li').prop('id');
						var todo = todoRoot.getTodo(liDomId);
						todo.setCompleteness(!todo.completed);
						this.render();  // Retains focus on this.todoInFocus
					}).bind(this))
				.on('mousedown', '.destroy', (function(e) {
						// User clicked on one of the little red x's to destroy a todo
						this.updateTodoInFocus(false);
						var id = $(e.target).closest('li').prop('id');
						var todoToDestroy = todoRoot.getTodo(id);
						// node will be the node to focus to after the destroy is completed
						// If the currently-in-focus todo will be destroyed,
							// change focus to the todo above the one whose destroy button was clicked
						var node = this.todoInFocus;
						if ( node !== null && (node.isDescendentOf(todoToDestroy) || node === todoToDestroy) ) {
							node = todoToDestroy.getNodeAbove();
						}
						todoToDestroy.destroy();
						if (node === todoRoot) {
							// If there were no non-destroyed nodes above the node previously in focus,
							// focus on the next node down that is not destroyed.
							if (todoRoot.children.length > 0) {
								node = todoRoot.children[0];
							} else {
								// No todos left!
								node = null;
							}
						}
						this.render(node);
					}).bind(this))
				.on('mousedown', 'label', (function(e) {
						// User clicked a todo; select it
						this.updateTodoInFocus(true);
						var id = $(e.target).closest('li').prop('id');
						this.render(todoRoot.getTodo(id))
					}).bind(this))
				.on('keydown', '.edit', (function(e) {
						// This event is triggered when user types in the todo-editing text box
						var $el = $(e.target);
						var liDomId = $el.closest('li').prop('id');
						var todo = todoRoot.getTodo(liDomId);
						// If user pressed enter, save text changes and create new younger sibling for this todo
						if (e.which === ENTER_KEY) {
							var trimmedVal = $el.val().trim();
							$el.val(trimmedVal);  // Trim the input's value
							if (trimmedVal !== "") {
								todo.setTitle(trimmedVal);
								var newTodo = todo.parent.createChild("", false, todo.localId+1);
								this.render(newTodo);
							}
						}
						// If user pressed escape, blur the focus (without saving changes)
						else if (e.which === ESCAPE_KEY) {
							if ($el.val().trim() === "") {
								todo.destroy();
							}
							this.render(null);
						}
						else if (e.which === TAB_KEY) {
							e.preventDefault();  // Prevents tab navigation among elements in DOM
							todo.setTitle($el.val().trim());
							if (e.shiftKey) {
								todo.unindent();
							} else {
								todo.indent();
							}
							this.render(todo);
						}
						else if (e.which === UP_ARROW) {
							var nodeAbove = todo.getNodeAbove();
							if (nodeAbove !== todoRoot) {
								this.updateTodoInFocus(true);
								this.render(nodeAbove);
							}
						}
						else if (e.which === DOWN_ARROW) {
							var nodeBelow = todo.getNodeBelow();
							if (nodeBelow !== null) {
								this.updateTodoInFocus(true);
								this.render(nodeBelow);
							}
						}
					}).bind(this))
				.on('focusout', '.edit', (function(e) {
						// This can happen from:
							// User clicking on the background
							// User clicking on one of the filter buttons (all, active, completed)
						// All other ways of triggering focusout are suppressed
						if (this.suppressFocusOutEvent) {
							// A call to this.render (all major events do this) immediately suppresses focusout events
							// focusout events are re-enabled at the end of this.render
							return;
						}
						this.updateTodoInFocus(true);
						this.render(null);
					}).bind(this));

		},
		// End bindEvents function definition
		


		// this.updateTodoInFocus updates the title of this.todoInFocus
			// using the text in the associated input field
		updateTodoInFocus: function(shouldDestroyIfBlank) {
			if (this.todoInFocus === null) return;
			var newTitle = $("#" + this.todoInFocus.longId).find(".edit").val().trim();
			if (newTitle === "" && shouldDestroyIfBlank) {
				this.todoInFocus.destroy();
				this.todoInFocus = null;
			} else {
				this.todoInFocus.setTitle(newTitle);
			}
		},

		// this.render re-creates the DOM from the current data in the todo tree
		// If the todo tree is empty, it adds one empty todo
		// After creating the DOM, it places focus on this.todoInFocus
		// Calling this.render immediately suppresses focusout events,
			// and focusout events continue to be suppressed until rendering is complete
		// todoInFocus is optional -- it updates this.todoInFocus, which is immediately used in the rendering
		render: function (todoInFocus) {
			if (todoInFocus !== undefined) this.todoInFocus = todoInFocus;
			this.suppressFocusOutEvent = true;

			// The setTimeout gives time for any focusout event to be suppressed
			setTimeout((function() {
				// If there are no todos, create one blank one
				if (todoRoot.children.length === 0) {
					todoRoot.createChild("");
				}

				// Generate (filtered) flat array of all todos
				var allTodos = todoRoot.getSimplifiedArrayOfDescendents();
				var activeTodos = allTodos.filter(function(todo) { return !todo.completed; });
				var todosToDisplay;
				if (this.filter === 'active') {
					todosToDisplay = activeTodos;
				} else if (this.filter === 'completed') {
					todosToDisplay = allTodos.filter(function(todo) { return todo.completed; });
				} else {
					todosToDisplay = allTodos;
				}

				// If there is a blank todo, focus on it
				var blankTodo = todosToDisplay.find(function(todo) {
					return todo.title === "";
				});
				if (blankTodo) this.todoInFocus = todoRoot.getTodo(blankTodo.longId);

				var allTodoCount = allTodos.length;
				var activeTodoCount = activeTodos.length;
				if (blankTodo) {
					allTodoCount--;
					activeTodoCount--;
				}

				// Use array data to compile HTML templates	
				$('#todo-list').html(this.todoTemplate(todosToDisplay));
				this.renderFooter(allTodoCount, activeTodoCount);

				// After DOM has settled down, set the focus and re-enable focusout events
				setTimeout((function() {
					this.renderTodoInFocus();
					this.suppressFocusOutEvent = false;
				}).bind(this), 0);
			}).bind(this), 0);
		},
		renderFooter: function (todoCount, activeTodoCount) {
			var template = this.footerTemplate({
				activeTodoCount: activeTodoCount,
				activeTodoWord: util.pluralize(activeTodoCount, 'item'),
				completedTodos: todoCount - activeTodoCount,
				filter: this.filter
			});
			$('#footer').toggle(todoCount > 0).html(template);
		},
		renderTodoInFocus: function() {
			if (this.todoInFocus !== null) {
				var $li = $("#" + this.todoInFocus.longId);
				$li.addClass('editing');
				$li.find('.edit').focus();
			}
		},

	};
	// End definition of App object





	App.init();
});
