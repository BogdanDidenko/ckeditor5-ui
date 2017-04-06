/**
 * Copyright (c) 2016, CKSource - Frederico Knabben. All rights reserved.
 */

import ClassicTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/classictesteditor';
import ContextualToolbar from '../../src/toolbar/contextualtoolbar';
import ContextualBalloon from '../../src/contextualballoon';
import ToolbarView from '../../src/toolbar/toolbarview';
import Bold from '@ckeditor/ckeditor5-basic-styles/src/bold';
import Italic from '@ckeditor/ckeditor5-basic-styles/src/italic';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import global from '@ckeditor/ckeditor5-utils/src/dom/global';

import { setData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model.js';

/* global document, window, setTimeout */

describe( 'ContextualToolbar', () => {
	let sandbox, editor, contextualToolbar, balloon, editorElement;

	beforeEach( () => {
		sandbox = sinon.sandbox.create();

		editorElement = document.createElement( 'div' );
		document.body.appendChild( editorElement );

		return ClassicTestEditor.create( editorElement, {
			plugins: [ Paragraph, Bold, Italic, ContextualToolbar ],
			contextualToolbar: [ 'bold', 'italic' ]
		} )
		.then( newEditor => {
			newEditor.editing.view.attachDomRoot( editorElement );

			editor = newEditor;
			contextualToolbar = editor.plugins.get( ContextualToolbar );
			balloon = editor.plugins.get( ContextualBalloon );

			// Focus the engine.
			editor.editing.view.isFocused = true;

			stubClientRects();
		} );
	} );

	afterEach( () => {
		sandbox.restore();
		editor.destroy();
	} );

	it( 'should be loaded', () => {
		expect( contextualToolbar ).to.instanceOf( ContextualToolbar );
	} );

	it( 'should load ContextualBalloon', () => {
		expect( balloon ).to.instanceof( ContextualBalloon );
	} );

	it( 'should create plugin instance with properties', () => {
		expect( contextualToolbar.toolbarView ).to.instanceof( ToolbarView );
	} );

	it( 'should create components from config', () => {
		expect( contextualToolbar.toolbarView.items ).to.length( 2 );
	} );

	it( 'should fire internal `_selectionChangeDone` event 200 ms after last selection change', () => {
		// This test uses setTimeout to test lodash#debounce because sinon fake timers
		// doesn't work with lodash. Lodash keeps time related stuff in a closure
		// and sinon is not able to override it.

		const spy = sandbox.spy();
		setData( editor.document, '<paragraph>[bar]</paragraph>' );
		contextualToolbar.on( '_selectionChangeDone', spy );

		editor.document.selection.fire( 'change:range' );

		// Not yet.
		sinon.assert.notCalled( spy );

		// Lets wait 100 ms.
		setTimeout( () => {
			// Still not yet.
			sinon.assert.notCalled( spy );

			// Fire event one more time.
			editor.document.selection.fire( 'change:range' );

			// Another 100 ms waiting.
			setTimeout( () => {
				// Still not yet.
				sinon.assert.notCalled( spy );

				// Another 100 ms waiting.
				setTimeout( () => {
					// And here it is.
					sinon.assert.calledOnce( spy );
				}, 100 );
			}, 100 );
		}, 100 );
	} );

	it( 'should open when selection stops changing', () => {
		setData( editor.document, '<paragraph>[bar]</paragraph>' );

		expect( balloon.visibleView ).to.null;

		contextualToolbar.fire( '_selectionChangeDone' );

		expect( balloon.visibleView ).to.equal( contextualToolbar.toolbarView );
	} );

	it( 'should close when selection starts changing', () => {
		setData( editor.document, '<paragraph>[bar]</paragraph>' );

		contextualToolbar.fire( '_selectionChangeDone' );

		expect( balloon.visibleView ).to.equal( contextualToolbar.toolbarView );

		editor.document.selection.fire( 'change:range' );

		expect( balloon.visibleView ).to.null;
	} );

	it( 'should open below if the selection is forward', () => {
		setData( editor.document, '<paragraph>[bar]</paragraph>' );

		contextualToolbar.fire( '_selectionChangeDone' );

		expect( balloon.visibleView ).to.equal( contextualToolbar.toolbarView );
		expect( balloon.view.top ).to.be.above( 310 );
	} );

	it( 'should open above if the selection is forward but panel stick out of the limiter element', () => {
		setData( editor.document, '<paragraph>[bar]</paragraph>' );

		// Mock limiter rect.
		mockBoundingBox( document.body, {
			left: 0,
			width: 1000,
			top: 0,
			height: 310
		} );

		contextualToolbar.fire( '_selectionChangeDone' );

		expect( balloon.visibleView ).to.equal( contextualToolbar.toolbarView );
		expect( balloon.view.top ).to.be.below( 310 );
	} );

	it( 'should open above if the selection is backward', () => {
		setData( editor.document, '<paragraph>[bar]</paragraph>', { lastRangeBackward: true } );

		contextualToolbar.fire( '_selectionChangeDone' );

		expect( balloon.visibleView ).to.equal( contextualToolbar.toolbarView );
		expect( balloon.view.top ).to.be.below( 100 );
	} );

	it( 'should open below if the selection is backward but panel stick out of the limiter element', () => {
		setData( editor.document, '<paragraph>[bar]</paragraph>', { lastRangeBackward: true } );

		// Mock limiter rect.
		mockBoundingBox( document.body, {
			left: 0,
			width: 1000,
			top: 95,
			height: 905
		} );

		contextualToolbar.fire( '_selectionChangeDone' );

		expect( balloon.visibleView ).to.equal( contextualToolbar.toolbarView );
		expect( balloon.view.top ).to.be.above( 100 );
	} );

	it( 'should not open if the collapsed selection is moving', () => {
		setData( editor.document, '<paragraph>ba[]r</paragraph>' );

		editor.document.selection.fire( 'change:range' );
		contextualToolbar.fire( '_selectionChangeDone' );

		setData( editor.document, '<paragraph>b[]ar</paragraph>' );

		editor.document.selection.fire( 'change:range' );
		contextualToolbar.fire( '_selectionChangeDone' );

		expect( balloon.visibleView ).to.null;
	} );

	it( 'should hide if the editor loses focus', () => {
		setData( editor.document, '<paragraph>[bar]</paragraph>' );
		editor.ui.focusTracker.isFocused = true;

		contextualToolbar.fire( '_selectionChangeDone' );

		expect( balloon.visibleView ).to.equal( contextualToolbar.toolbarView );

		editor.ui.focusTracker.isFocused = false;

		expect( balloon.visibleView ).to.null;
	} );

	it( 'should do nothing when panel is being added to balloon stack twice', () => {
		setData( editor.document, '<paragraph>[bar]</paragraph>' );

		contextualToolbar.fire( '_selectionChangeDone' );

		expect( balloon.visibleView ).to.equal( contextualToolbar.toolbarView );

		expect( () => {
			contextualToolbar.fire( '_selectionChangeDone' );
		} ).to.not.throw();
	} );

	function stubClientRects() {
		const editingView = editor.editing.view;
		const originalViewRangeToDom = editingView.domConverter.viewRangeToDom;

		// Mock selection rect.
		sandbox.stub( editingView.domConverter, 'viewRangeToDom', ( ...args ) => {
			const domRange = originalViewRangeToDom.apply( editingView.domConverter, args );

			sandbox.stub( domRange, 'getClientRects', () => {
				return {
					length: 2,
					item: id => {
						if ( id === 0 ) {
							return {
								top: 100,
								height: 10,
								bottom: 110,
								left: 200,
								width: 50,
								right: 250
							};
						}

						return {
							top: 300,
							height: 10,
							bottom: 310,
							left: 400,
							width: 50,
							right: 450
						};
					}
				};
			} );

			return domRange;
		} );

		// Mock window rect.
		sandbox.stub( global, 'window', {
			innerWidth: 1000,
			innerHeight: 1000,
			scrollX: 0,
			scrollY: 0,
			getComputedStyle: el => {
				return window.getComputedStyle( el );
			}
		} );

		// Mock balloon rect.
		mockBoundingBox( balloon.view.element, {
			width: 150,
			height: 50
		} );
	}

	function mockBoundingBox( element, data ) {
		const boundingBox = Object.assign( {}, data );

		boundingBox.right = boundingBox.left + boundingBox.width;
		boundingBox.bottom = boundingBox.top + boundingBox.height;

		sandbox.stub( element, 'getBoundingClientRect' ).returns( boundingBox );
	}
} );
