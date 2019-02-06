
Beast7 from Watch and Code, by Jacob Rodeheffer

Some cool features of this project:
- Todo data is organized into a tree of parent nodes and children nodes.
- Individual nodes are created using a TodoNode.prototype, which comes with built-in properties and methods.
- Indentation of a todo is represented by left-padding the todo's li, which is calculated in the template using a Handlebars helper.
- GUI controls are similar to a bullet list in a word processor: tab/shift-tab for indenting, enter for new line, arrow keys or clicking to navigate.

The hardest part for me was managing which element had focus in the DOM. I ended up mostly suppressing the focusout event, since it was hard to control when it is triggered.

My favorite part of this project was working out the algorithms needed to do specific tasks with the todo data, such as finding the next todo node "up" from the current one in flat order (not tree order).

Some of the things I learned from this project:
- JavaScript event bubbling/the order in which JavaScript events are triggered
- How to suppress the default response to an event in JavaScript
- How to make and use Handlebars helpers
- How to make data compatible with JSON.stringify

And it was a great review for these topics:
- IIFEs
- setTimeout/the JavaScript event queue
- recursion
- jQuery
- array manipulation
- constructors and prototypes
- coding discipline: keeping code well-commented, well-structured, and easy to read

As of 2/6/19, I have not found any more bugs, but that doesn't mean there aren't any. I'd be glad to hear about it if you find some.









-- Continue below for the original TodoMVC readme --





# jQuery TodoMVC Example

> jQuery is a fast, small, and feature-rich JavaScript library. It makes things like HTML document traversal and manipulation, event handling, animation, and Ajax much simpler with an easy-to-use API that works across a multitude of browsers. With a combination of versatility and extensibility, jQuery has changed the way that millions of people write JavaScript.

> _[jQuery - jquery.com](http://jquery.com)_


## Learning jQuery

The [jQuery website](http://jquery.com) is a great resource for getting started.

Here are some links you may find helpful:

* [Learning Center](http://learn.jquery.com/)
* [API Reference](http://api.jquery.com)
* [Plugins](http://plugins.jquery.com)
* [Browser Support](http://jquery.com/browser-support)
* [Blog](http://blog.jquery.com)

Articles and guides from the community:

* [Try jQuery](http://try.jquery.com)
* [jQuery Annotated Source](http://github.com/robflaherty/jquery-annotated-source)
* [10 Things I Learned From the jQuery Source](http://paulirish.com/2010/10-things-i-learned-from-the-jquery-source)

Get help from other jQuery users:

* [jQuery on StackOverflow](http://stackoverflow.com/questions/tagged/jquery)
* [Forums](http://forum.jquery.com)
* [jQuery on Twitter](http://twitter.com/jquery)
* [jQuery on Google +](https://plus.google.com/102828491884671003608/posts)

_If you have other helpful links to share, or find any of the links above no longer work, please [let us know](https://github.com/tastejs/todomvc/issues)._
