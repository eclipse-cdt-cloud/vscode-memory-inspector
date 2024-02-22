/********************************************************************************
 * Copyright (C) 2022 Ericsson, Arm and others.
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

export const PACKAGE_NAME = 'memory-inspector';
export const DISPLAY_NAME = 'Memory Inspector';
export const EDITOR_NAME = `${PACKAGE_NAME}.inspect`;

export const CONFIG_LOGGING_VERBOSITY = 'loggingVerbosity';
export const DEFAULT_LOGGING_VERBOSITY = 'warn';
export const CONFIG_DEBUG_TYPES = 'debugTypes';
export const DEFAULT_DEBUG_TYPES = ['gdb', 'embedded-debug', 'arm-debugger'];
export const CONFIG_REFRESH_ON_STOP = 'refreshOnStop';
export const DEFAULT_REFRESH_ON_STOP = 'on';

export const CONFIG_WORDS_PER_GROUP = 'groupings.wordsPerGroup';
export const DEFAULT_WORDS_PER_GROUP = 1;
export const CONFIG_GROUPS_PER_ROW = 'groupings.groupsPerRow';
export const DEFAULT_GROUPS_PER_ROW = 4;
export const CONFIG_SCROLLING_BEHAVIOR = 'scrollingBehavior';
export const DEFAULT_SCROLLING_BEHAVIOR = 'Paginate';
export const CONFIG_ADDRESS_RADIX = 'addressRadix';
export const DEFAULT_ADDRESS_RADIX = 16;
export const CONFIG_SHOW_RADIX_PREFIX = 'showRadixPrefix';
export const DEFAULT_SHOW_RADIX_PREFIX = true;

export const CONFIG_SHOW_VARIABLES_COLUMN = 'columns.variables';
export const CONFIG_SHOW_ASCII_COLUMN = 'columns.ascii';
