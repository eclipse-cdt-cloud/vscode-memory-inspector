/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

/**
 * Calculates the width of the element without any padding / margin / border
 */
export function elementInnerWidth(element: HTMLElement): number {
    const styles = window.getComputedStyle(element);
    const padding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    return parseFloat(styles.width) - padding;
}

/**
 * Calculates the width of the provided text within the container
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText
 */
export function characterWidthInContainer(container: HTMLElement, text: string): number {
    let width = 1;
    const style = window.getComputedStyle(container);
    const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (context) {
        context.font = font;
        width = context.measureText(text).width;
    }

    return width;
}
